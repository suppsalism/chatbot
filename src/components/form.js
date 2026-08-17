import { CLASS } from '../constants/class-names';

/**
 * A form attached to an agent message, built from a normalized spec (see
 * core/form-spec.js). Every control is native, so validation and keyboard
 * behavior come from the browser rather than from code kept alive here.
 *
 * The component owns presentation and value collection only. Deciding what to
 * do with the values — and what the bot says next — belongs to the consumer's
 * `onSubmit`.
 */
export class Form {
  constructor({ doc, spec }) {
    this.doc = doc;
    this.spec = spec;
    this.listeners = [];
    this.controls = new Map();
    this.locked = false;
    this.pending = false;

    this.build();
  }

  on(node, event, handler) {
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  createControl(field) {
    const { doc } = this;

    if (field.type === 'textarea') {
      const textarea = doc.createElement('textarea');
      textarea.rows = 3;
      if (typeof field.value === 'string') textarea.value = field.value;
      return textarea;
    }

    if (field.type === 'select') {
      const select = doc.createElement('select');
      for (const option of field.options) {
        const optionEl = doc.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        select.appendChild(optionEl);
      }
      if (typeof field.value === 'string') select.value = field.value;
      return select;
    }

    const input = doc.createElement('input');
    input.type = field.type;
    if (field.type === 'checkbox') {
      input.checked = field.value === true;
    } else if (typeof field.value === 'string') {
      input.value = field.value;
    }
    return input;
  }

  build() {
    const { doc, spec } = this;

    const form = doc.createElement('form');
    form.className = CLASS.form;
    form.noValidate = false;

    if (spec.title) {
      const title = doc.createElement('p');
      title.className = CLASS.formTitle;
      title.textContent = spec.title;
      form.appendChild(title);
    }

    for (const field of spec.fields) {
      const wrapper = doc.createElement('div');
      wrapper.className = `${CLASS.formField} ${
        field.type === 'checkbox' ? CLASS.formFieldInline : ''
      }`.trim();

      const control = this.createControl(field);
      control.name = field.name;
      control.required = field.required;
      control.className = CLASS.formControl;
      if (field.placeholder) control.setAttribute('placeholder', field.placeholder);

      const label = doc.createElement('label');
      label.className = CLASS.formLabel;
      label.textContent = field.label;

      // A checkbox reads as "[x] label"; everything else as "label" above its control.
      if (field.type === 'checkbox') {
        wrapper.appendChild(control);
        wrapper.appendChild(label);
      } else {
        wrapper.appendChild(label);
        wrapper.appendChild(control);
      }

      form.appendChild(wrapper);
      this.controls.set(field.name, { control, field });
    }

    const action = doc.createElement('div');
    action.className = CLASS.formAction;

    const submitButton = doc.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = CLASS.formSubmit;
    submitButton.textContent = spec.submitLabel;
    action.appendChild(submitButton);
    form.appendChild(action);

    this.on(form, 'submit', (event) => {
      event.preventDefault();
      this.submit();
    });

    this.element = form;
    this.submitButton = submitButton;
  }

  /**
   * Collects the values, hands them to the spec's own onSubmit, and applies the
   * outcome it reports back: `true` closes the form for good, `false` returns
   * it to the user.
   *
   * The component owns its own visual state, so the handler never needs a
   * reference to this instance — which is what lets the handler live on the
   * spec rather than being threaded through as a second prop.
   */
  async submit() {
    if (this.locked || this.pending) return;

    // Explicit rather than relying on the browser to block an invalid submit,
    // so the guard holds identically under jsdom.
    if (typeof this.element.checkValidity === 'function' && !this.element.checkValidity()) {
      this.element.reportValidity?.();
      return;
    }

    if (!this.spec.onSubmit) return;

    this.pending = true;
    this.setDisabled(true);

    let shouldLock = false;
    try {
      shouldLock = await this.spec.onSubmit(this.values());
    } finally {
      this.pending = false;
      if (shouldLock) this.lock();
      else this.setDisabled(false);
    }
  }

  /** Current values keyed by field name; checkboxes are booleans, everything else a string. */
  values() {
    const values = {};
    for (const [name, { control, field }] of this.controls) {
      values[name] = field.type === 'checkbox' ? control.checked : control.value;
    }
    return values;
  }

  /** Temporarily blocks interaction — used while an async onSubmit is in flight. */
  setDisabled(disabled) {
    if (this.locked) return;
    this.submitButton.disabled = disabled;
    for (const { control } of this.controls.values()) control.disabled = disabled;
    this.element.classList.toggle(CLASS.formDisabled, disabled);
  }

  /** Permanently closes the form after a successful submit, so it cannot be sent twice. */
  lock() {
    this.locked = true;
    this.submitButton.disabled = true;
    for (const { control } of this.controls.values()) control.disabled = true;
    this.element.classList.add(CLASS.formDisabled, CLASS.formSubmitted);
  }

  destroy() {
    this.listeners.forEach(([node, event, handler]) => node.removeEventListener(event, handler));
    this.element.remove();
  }
}
