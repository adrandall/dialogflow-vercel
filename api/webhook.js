const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const fetch = require('node-fetch');

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; // Add in Vercel Environment Variables

export default async function handler(req, res) {
  const agent = new WebhookClient({ request: req, response: res });

  async function handleFallback(agent) {
    // Get Messenger PSID
    const senderId = req.body.originalDetectIntentRequest.payload.data.sender.id;

    // Fetch first name from Facebook Graph API
    let firstName = "there";
    try {
      const fbRes = await fetch(
        `https://graph.facebook.com/${senderId}?fields=first_name&access_token=${PAGE_ACCESS_TOKEN}`
      );
      const fbData = await fbRes.json();
      if (fbData.first_name) firstName = fbData.first_name;
    } catch (err) {
      console.error("Facebook API error:", err);
    }

    // Example: pass name to Dialogflow text response
    agent.add(`Hi ${firstName}! I didn’t understand that. Can you rephrase?`);

    // Optional: Send a Messenger payload (button template)
    const payloadData = {
      "facebook": {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": `Hi ${firstName}! Do you want to try again?`,
            "buttons": [
              { "type": "postback", "title": "Yes", "payload": "yes" },
              { "type": "postback", "title": "Not Yet", "payload": "not_yet" }
            ]
          }
        }
      }
    };
    agent.add(new Payload(agent.FACEBOOK, payloadData, { rawPayload: true, sendAsMessage: true }));
  }

  // Map intents to handler
  const intentMap = new Map();
  intentMap.set('Default Fallback Intent', handleFallback);

  agent.handleRequest(intentMap);
}
