# Suppsalism Chatbot


## What is Suppsalism Chatbot?

Suppsalism Chatbot is an AI-powered library designed to provide an interactive question-answer feature on your website. This chatbot leverages collected and trained data provided by the user to deliver accurate and contextually relevant answers. It's perfect for enhancing user engagement by addressing user inquiries instantly and effectively.

This library is built with multiple output formats (CJS, UMD, and ESM) to cater to different usage scenarios.

## Building the Library

Before integrating the chatbot into your application, ensure that the library files are built:

```
npm run build
```

This command compiles the source code into distributable formats under the dist folder.

## Development

To continuously watch and recompile the files during development:

```
npm run dev
```

## Integration Steps

To use the chatbot in your web application, follow these steps:

### Include the Script

Add the following script tag in the <head> section of your HTML pages where the chatbot should appear:

```
<script
  type="text/javascript"
  id="suppsalism-script-loader"
  async
  src="SUPPSALISM_CDN_CHATBOT_LIBRARY"
></script>
```

This script is asynchronous to ensure that it does not block the loading of other page elements.

### Add chatbot tag

In the <body> of your HTML, where you want the chatbot to display, add the following tag:

```
<ss-chat data-key="CHATBOT_KEY"></ss-chat>
```

Ensure you replace data-key with the actual key provided for your chatbot instance.

## License

[MIT](https://github.com/suppsalism/chatbot/blob/main/LICENSE.md)
