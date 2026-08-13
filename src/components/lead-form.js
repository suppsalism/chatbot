import { CLASS } from '../constants/class-names';

const FIELDS = [
  { key: 'firstName', label: 'First name', type: 'text', required: true },
  { key: 'lastName', label: 'Last name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'message', label: 'Message', type: 'text', required: false },
];

/** First name, last name, email, message — shown when config.collectLeads is on (spec §4.4). */
export class LeadForm {
  constructor({ doc, onSubmit = () => {} }) {
    this.doc = doc;
    this.onSubmit = onSubmit;
    this.listeners = [];
    this.inputs = {};

    this.build();
  }

  on(node, event, handler) {
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  build() {
    const form = this.doc.createElement('form');
    form.className = CLASS.leadFormWrapper;

    FIELDS.forEach(({ key, label, type, required }) => {
      const field = this.doc.createElement('div');
      field.className = CLASS.leadFormField;

      const labelEl = this.doc.createElement('label');
      labelEl.textContent = label;
      field.appendChild(labelEl);

      const input = this.doc.createElement('input');
      input.type = type;
      input.required = required;
      input.name = key;
      field.appendChild(input);

      form.appendChild(field);
      this.inputs[key] = input;
    });

    const action = this.doc.createElement('div');
    action.className = CLASS.leadFormAction;

    const submitButton = this.doc.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Send';
    action.appendChild(submitButton);

    form.appendChild(action);

    this.on(form, 'submit', (event) => {
      event.preventDefault();
      const fields = {};
      for (const key of Object.keys(this.inputs)) fields[key] = this.inputs[key].value;
      this.onSubmit(fields);
      form.reset();
    });

    this.element = form;
  }

  destroy() {
    this.listeners.forEach(([node, event, handler]) => node.removeEventListener(event, handler));
    this.element.remove();
  }
}
