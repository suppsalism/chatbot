import { createSignal, createEffect } from '../reactive/signal';
import { generateUuid } from '../utils/uuid';

/** The four signals the widget owns (spec §8.1). */
export function initState(config) {
  const [message, setMessage] = createSignal('');
  const [disabledSubmit, setDisabledSubmit] = createSignal(false);
  const [chatVisible, setChatVisible] = createSignal(Boolean(config.autoOpen));
  const [conversation, setConversation] = createSignal(
    (config.initialMessages || []).map((text) => ({
      messageId: generateUuid(),
      role: 'agent',
      text,
      timestamp: Date.now(),
    }))
  );

  function appendToConversation(entry) {
    setConversation((current) => [...current, entry]);
  }

  return {
    message,
    setMessage,
    disabledSubmit,
    setDisabledSubmit,
    chatVisible,
    setChatVisible,
    conversation,
    appendToConversation,
  };
}

/** The two DOM effects bound outside any single component (guide §2). */
export function bindEffects({ state, shell, view }) {
  createEffect(() => shell.setVisible(state.chatVisible()));
  createEffect(() => view.setSubmitDisabled(state.disabledSubmit()));
}
