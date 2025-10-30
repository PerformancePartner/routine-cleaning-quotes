export default async function handler(req, res) {
  // Enable CORS for Vapi
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  try {
    // Log the FULL incoming request for debugging
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

    // Extract parameters from Vapi's nested structure
    let params = req.body;
    
    // Vapi sends parameters in: message.toolCalls[0].function.arguments
    if (req.body.message && req.body.message.toolCalls && req.body.message.toolCalls.length > 0) {
      params = req.body.message
