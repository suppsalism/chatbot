/**
 * Single source of truth for every class name, id, and tag name the widget
 * uses. No other module may write a DOM class/id/tag literal (guide §3.6).
 */

export const CHAT_TAG_NAME = 'ss-chat';

export const CLASS = {
  // shell (host page)
  shellContainer: 'ss-shell',
  shellVisible: 'ss-visible',
  shellLeft: 'ss-left',
  shellRight: 'ss-right',
  iframe: 'ss-iframe',
  launcher: 'ss-launcher',

  // theme (iframe body)
  themeLight: 'ss-theme-light',
  themeDark: 'ss-theme-dark',

  // wrapper
  wrapper: 'ss-wrapper',
  wrapperContainer: 'ss-wrapper-container',
  wrapperContent: 'ss-wrapper-content',

  // thead
  theadWrapper: 'ss-thead-wrapper',
  theadContainer: 'ss-thead-container',
  theadContent: 'ss-thead-content',
  theadLeft: 'ss-thead-left',
  theadRight: 'ss-thead-right',
  theadAvatar: 'ss-thead-avatar',
  theadName: 'ss-thead-name',
  theadClose: 'ss-thead-close',

  // message wrapper
  messageWrapperWrapper: 'ss-message-wrapper-wrapper',
  messageWrapperContainer: 'ss-message-wrapper-container',

  // message
  messageWrapper: 'ss-message-wrapper',
  messageContainer: 'ss-message-container',
  messageGroup: 'ss-message-group',
  messageAvatarWrapper: 'ss-message-avatar-wrapper',
  messageAvatar: 'ss-message-avatar',
  message: 'ss-message',
  messageLeft: 'ss-left',
  messageRight: 'ss-right',
  messageError: 'ss-message-error',

  // typing
  typing: 'ss-typing',
  typingDot: 'ss-typing-dot',

  // feedback
  feedbackWrapper: 'ss-feedback-wrapper',
  feedbackButton: 'ss-feedback-button',
  feedbackUp: 'ss-feedback-up',
  feedbackDown: 'ss-feedback-down',
  feedbackActive: 'ss-feedback-active',

  // composer
  composerWrapper: 'ss-composer-wrapper',
  composerContainer: 'ss-composer-container',
  composerEditor: 'ss-composer-editor',
  composerExpanded: 'ss-composer-expanded',
  composerContent: 'ss-composer-content',
  composerTextarea: 'ss-composer-textarea',
  composerAction: 'ss-composer-action',
  composerHighlight: 'ss-composer-highlight',
  composerDisabled: 'ss-disabled',

  // suggestion
  suggestionWrapperWrapper: 'ss-suggestion-wrapper-wrapper',
  suggestionWrapperContainer: 'ss-suggestion-wrapper-container',
  suggestionWrapperContent: 'ss-suggestion-wrapper-content',
  suggestion: 'ss-suggestion',
  suggestionDisabled: 'ss-disabled',

  // lead form
  leadFormWrapper: 'ss-lead-form-wrapper',
  leadFormField: 'ss-lead-form-field',
  leadFormAction: 'ss-lead-form-action',

  // signature
  signatureWrapper: 'ss-signature-wrapper',
  signature: 'ss-signature',
};

export const shellId = (instanceId) => `ss-chat-shell-${instanceId}`;
export const iframeId = (instanceId) => `ss-chat-iframe-${instanceId}`;
