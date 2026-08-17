import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatbot } from '../../src/core/create-chatbot';

/**
 * The form end to end: a reply carries a `form`, it renders inside that
 * message's bubble, and its own onSubmit decides what happens next.
 */
describe('reply forms', () => {
  let mount;
  let bot;
  let doc;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    bot?.destroy();
    mount.remove();
  });

  function boot(onSendMessage) {
    bot = createChatbot({ mount, onSendMessage });
    doc = mount.querySelector('iframe').contentWindow.document;
  }

  const form = () => doc.querySelector('.ss-form');
  const control = (name) => doc.querySelector(`.ss-form [name="${name}"]`);
  const bubbles = () => [...doc.querySelectorAll('.ss-message')].map((n) => n.textContent);
  const submit = () => form().dispatchEvent(new doc.defaultView.Event('submit', { bubbles: true }));

  const leadForm = (onSubmit) => ({
    text: 'Mind sharing where to reach you?',
    form: {
      id: 'lead',
      title: 'Please share your name and email so we can follow up with you later.',
      submitLabel: 'Subscribe',
      fields: [
        { name: 'name', label: 'Name', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'note', label: 'Anything else?', type: 'textarea' },
        { name: 'optIn', label: 'Email me updates', type: 'checkbox' },
      ],
      onSubmit,
    },
  });

  it('renders the form inside the message it arrived with', async () => {
    boot(() => leadForm(() => {}));
    await bot.submit('hi');

    const messages = doc.querySelectorAll('.ss-message-wrapper');
    const agentMessage = messages[messages.length - 1];

    expect(agentMessage.querySelector('.ss-form')).not.toBeNull();
    expect(doc.querySelectorAll('.ss-form')).toHaveLength(1);
  });

  it('renders title, submit label, and one control per field', async () => {
    boot(() => leadForm(() => {}));
    await bot.submit('hi');

    expect(doc.querySelector('.ss-form-title').textContent).toBe(
      'Please share your name and email so we can follow up with you later.'
    );
    expect(doc.querySelector('.ss-form-submit').textContent).toBe('Subscribe');
    expect(control('name').tagName).toBe('INPUT');
    expect(control('email').type).toBe('email');
    expect(control('note').tagName).toBe('TEXTAREA');
    expect(control('optIn').type).toBe('checkbox');
    expect(control('name').required).toBe(true);
    expect(control('note').required).toBe(false);
  });

  it('renders a select with its options', async () => {
    boot(() => ({
      text: 'Which plan?',
      form: {
        fields: [{ name: 'plan', type: 'select', options: ['Free', 'Pro'] }],
        onSubmit: () => {},
      },
    }));
    await bot.submit('hi');

    expect([...control('plan').options].map((o) => o.value)).toEqual(['Free', 'Pro']);
  });

  it('passes typed values and a context to onSubmit', async () => {
    const onSubmit = vi.fn();
    boot(() => leadForm(onSubmit));
    await bot.submit('hi');

    control('name').value = 'Ada';
    control('email').value = 'ada@example.com';
    control('note').value = 'call me';
    control('optIn').checked = true;
    submit();

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());

    const [values, context] = onSubmit.mock.calls[0];
    expect(values).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      note: 'call me',
      optIn: true,
    });
    expect(context.formId).toBe('lead');
    expect(context.messageId).toBeTypeOf('string');
    expect(context.sessionId).toBeTypeOf('string');
  });

  it('locks the form after a successful submit so it cannot be sent twice', async () => {
    const onSubmit = vi.fn();
    boot(() => leadForm(onSubmit));
    await bot.submit('hi');

    control('name').value = 'Ada';
    control('email').value = 'ada@example.com';
    submit();

    await vi.waitFor(() => expect(form().classList.contains('ss-form-submitted')).toBe(true));
    expect(control('email').disabled).toBe(true);
    expect(doc.querySelector('.ss-form-submit').disabled).toBe(true);

    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders a returned reply as a follow-up agent message', async () => {
    boot(() => leadForm(() => ({ text: "Thanks! We'll be in touch." })));
    await bot.submit('hi');

    control('name').value = 'Ada';
    control('email').value = 'ada@example.com';
    submit();

    await vi.waitFor(() =>
      expect(bubbles()).toEqual([
        'hi',
        'Mind sharing where to reach you?',
        "Thanks! We'll be in touch.",
      ])
    );
    expect(bot.getState().messages.at(-1)).toMatchObject({
      role: 'agent',
      text: "Thanks! We'll be in touch.",
    });
  });

  it('renders a returned array of replies', async () => {
    boot(() => leadForm(() => [{ text: 'Saved.' }, { text: 'Anything else?' }]));
    await bot.submit('hi');

    control('name').value = 'Ada';
    control('email').value = 'ada@example.com';
    submit();

    await vi.waitFor(() => expect(bubbles()).toHaveLength(4));
    expect(bubbles().slice(-2)).toEqual(['Saved.', 'Anything else?']);
  });

  it('keeps the form editable when onSubmit returns false', async () => {
    boot(() => leadForm(() => false));
    await bot.submit('hi');

    control('name').value = 'Ada';
    control('email').value = 'ada@example.com';
    submit();

    await vi.waitFor(() => expect(control('email').disabled).toBe(false));
    expect(form().classList.contains('ss-form-submitted')).toBe(false);
  });

  it('re-enables the form and reports when onSubmit throws', async () => {
    const onMessageError = vi.fn();
    bot = createChatbot({
      mount,
      onMessageError,
      onSendMessage: () =>
        leadForm(() => {
          throw new Error('save failed');
        }),
    });
    doc = mount.querySelector('iframe').contentWindow.document;

    await bot.submit('hi');
    control('name').value = 'Ada';
    control('email').value = 'ada@example.com';
    submit();

    await vi.waitFor(() => expect(onMessageError).toHaveBeenCalled());
    expect(control('email').disabled).toBe(false);
    expect(form().classList.contains('ss-form-submitted')).toBe(false);
  });

  it('blocks submission while a required field is empty', async () => {
    const onSubmit = vi.fn();
    boot(() => leadForm(onSubmit));
    await bot.submit('hi');

    submit(); // name and email are both required and empty

    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('drops an invalid field but still renders the rest of the form', async () => {
    boot(() => ({
      text: 'Details?',
      form: {
        fields: [{ label: 'no name here' }, { name: 'email', type: 'email' }],
        onSubmit: () => {},
      },
    }));
    await bot.submit('hi');

    expect(doc.querySelectorAll('.ss-form-control')).toHaveLength(1);
    expect(control('email')).not.toBeNull();
  });

  it('ignores a malformed form without losing the reply text', async () => {
    boot(() => ({ text: 'Still here', form: { fields: [] } }));
    await bot.submit('hi');

    expect(bubbles()).toEqual(['hi', 'Still here']);
    expect(form()).toBeNull();
  });

  it('never attaches a form to a user message', async () => {
    boot(() => 'ok');
    await bot.submit('hi');
    expect(doc.querySelector('.ss-message-wrapper.ss-right .ss-form')).toBeNull();
  });

  it('removes the form on destroy', async () => {
    boot(() => leadForm(() => {}));
    await bot.submit('hi');
    expect(form()).not.toBeNull();

    bot.destroy();
    bot = null;
    expect(mount.innerHTML).toBe('');
  });
});

/**
 * A form's onSubmit returns the same shape onSendMessage does, and a Reply may
 * carry a form — so a form can answer with another form. That composition is
 * what multi-step flows are built from; it is not special-cased anywhere.
 */
describe('multi-step forms', () => {
  let mount;
  let bot;
  let doc;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    bot?.destroy();
    mount.remove();
  });

  const step = (n, next) => ({
    text: `Step ${n}`,
    form: {
      id: `step-${n}`,
      fields: [{ name: `answer${n}`, label: `Answer ${n}`, required: true }],
      onSubmit: () => next,
    },
  });

  it('renders a form returned by a form, and keeps the previous one locked', async () => {
    bot = createChatbot({
      mount,
      onSendMessage: () => step(1, step(2, { text: 'All done.' })),
    });
    doc = mount.querySelector('iframe').contentWindow.document;

    await bot.submit('start');

    const forms = () => doc.querySelectorAll('.ss-form');
    expect(forms()).toHaveLength(1);

    doc.querySelector('[name="answer1"]').value = 'one';
    forms()[0].dispatchEvent(new doc.defaultView.Event('submit', { bubbles: true }));

    await vi.waitFor(() => expect(forms()).toHaveLength(2));
    expect(forms()[0].classList.contains('ss-form-submitted')).toBe(true);
    expect(doc.querySelector('[name="answer2"]')).not.toBeNull();

    doc.querySelector('[name="answer2"]').value = 'two';
    forms()[1].dispatchEvent(new doc.defaultView.Event('submit', { bubbles: true }));

    await vi.waitFor(() =>
      expect([...doc.querySelectorAll('.ss-message')].map((n) => n.textContent)).toContain(
        'All done.'
      )
    );
    expect(forms()[1].classList.contains('ss-form-submitted')).toBe(true);
  });

  it('records every step as its own conversation entry', async () => {
    bot = createChatbot({ mount, onSendMessage: () => step(1, step(2, { text: 'Done.' })) });
    doc = mount.querySelector('iframe').contentWindow.document;

    await bot.submit('start');
    doc.querySelector('[name="answer1"]').value = 'one';
    doc
      .querySelector('.ss-form')
      .dispatchEvent(new doc.defaultView.Event('submit', { bubbles: true }));

    await vi.waitFor(() => expect(bot.getState().messages).toHaveLength(3));
    expect(bot.getState().messages.map((m) => m.text)).toEqual(['start', 'Step 1', 'Step 2']);
  });

  it('supports a form inside an array of replies returned by a form', async () => {
    bot = createChatbot({
      mount,
      onSendMessage: () => step(1, [{ text: 'Saved.' }, step(2, { text: 'Done.' })]),
    });
    doc = mount.querySelector('iframe').contentWindow.document;

    await bot.submit('start');
    doc.querySelector('[name="answer1"]').value = 'one';
    doc
      .querySelector('.ss-form')
      .dispatchEvent(new doc.defaultView.Event('submit', { bubbles: true }));

    await vi.waitFor(() => expect(doc.querySelectorAll('.ss-form')).toHaveLength(2));
    expect([...doc.querySelectorAll('.ss-message')].map((n) => n.textContent)).toEqual([
      'start',
      'Step 1',
      'Saved.',
      'Step 2',
    ]);
  });
});
