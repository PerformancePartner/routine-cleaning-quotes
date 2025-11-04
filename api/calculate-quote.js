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

    // Extract toolCallId - Vapi needs this in the response
    let toolCallId = null;
    let params = req.body;
    
    // Vapi sends parameters in: message.toolCalls[0]
    if (req.body.message && req.body.message.toolCalls && req.body.message.toolCalls.length > 0) {
      const toolCall = req.body.message.toolCalls[0];
      toolCallId = toolCall.id;
      params = toolCall.function.arguments;
      console.log('Extracted toolCallId:', toolCallId);
      console.log('Extracted from toolCalls:', params);
    }

    const { 
      bedrooms, 
      bathrooms, 
      sqft_range, 
      basement, 
      frequency, 
      extras = "", 
      furniture_present = false, 
      location 
    } = params;

    console.log('Final extracted parameters:', {
      bedrooms,
      bathrooms,
      sqft_range,
      basement,
      frequency,
      extras,
      furniture_present,
      location
    });

    // Validate required fields
    if (!bedrooms || !bathrooms || !sqft_range || !basement || !frequency || !location) {
      console.error('Missing required fields');
      return res.status(400).json({
        results: [{
          toolCallId: toolCallId,
          result: JSON.stringify({
            success: false,
            error: 'Missing required fields',
            message: 'bedrooms, bathrooms, sqft_range, basement, frequency, and location are required'
          })
        }]
      });
    }

    // Pricing tables
    const sqftPrices = {
      "≤700": 93.75,
      "700-1000": 130.00,
      "1001-1500": 170.00,
      "1501-2200": 200.00,
      "2201-2800": 250.00,
      "2801-3200": 300.00,
      "3201-3600": 350.00,
      "3601-4000": 400.00,
      "4001-4400": 425.00,
      "4401-4800": 450.00,
      "4801-5200": 500.00,
      "5201-5600": 550.00
    };

    const bedroomPrices = {
      1: 37.50, 
      2: 75.00, 
      3: 112.50, 
      4: 150.00, 
      5: 187.50, 
      6: 225.00
    };
    
    const bathroomPrices = {
      1: 50.00, 
      1.5: 75.00, 
      2: 100.00, 
      2.5: 125.00, 
      3: 150.00, 
      3.5: 175.00, 
      4: 200.00, 
      4.5: 225.00, 
      5: 250.00
    };
    
    const basementPrices = {
      "none": 0, 
      "unfinished": 37.50, 
      "finished": 50.00
    };

    // Calculate base
    let base = (sqftPrices[sqft_range] || 0) + 
               (bedroomPrices[bedrooms] || 0) + 
               (bathroomPrices[bathrooms] || 0) + 
               (basementPrices[basement] || 0);

    // Apply frequency discount to base only
    const frequencyDiscounts = {
      "one-time": 1.0, 
      "weekly": 0.85, 
      "bi-weekly": 0.875, 
      "monthly": 0.90
    };
    let discountedBase = base * (frequencyDiscounts[frequency] || 1.0);

    // Parse extras string into array
    const extrasArray = extras ? extras.split(',').map(e => e.trim()) : [];
    
    // Calculate extras
    let totalExtras = 0;
    
    extrasArray.forEach(extra => {
      if (extra === "deep_clean") {
        if (["≤700", "700-1000"].includes(sqft_range)) totalExtras += 150.00;
        else if (sqft_range === "1001-1500") totalExtras += 200.00;
        else if (sqft_range === "1501-2200") totalExtras += 225.00;
        else totalExtras += 300.00;
      }
      else if (extra === "move_out") {
        if (furniture_present) {
          if (["≤700", "700-1000"].includes(sqft_range)) totalExtras += 150.00;
          else if (sqft_range === "1001-1500") totalExtras += 200.00;
          else if (sqft_range === "1501-2200") totalExtras += 225.00;
          else totalExtras += 300.00;
        } else {
          if (["≤700", "700-1000"].includes(sqft_range)) totalExtras += 100.00;
          else if (["1001-1500", "1501-2200"].includes(sqft_range)) totalExtras += 150.00;
          else totalExtras += 200.00;
        }
      }
      else if (extra === "fridge_empty") totalExtras += 50.00;
      else if (extra === "fridge_full") totalExtras += 75.00;
      else if (extra === "oven") totalExtras += 50.00;
      else if (extra === "dishes") totalExtras += 20.00;
      else if (extra === "organization") totalExtras += 50.00;
      else if (extra === "laundry_folding") totalExtras += 50.00;
      else if (extra === "upholstery") totalExtras += 50.00;
      else if (extra === "pets") totalExtras += 25.00;
      else if (extra === "windows_blinds") {
        if (["≤700", "700-1000"].includes(sqft_range)) totalExtras += 75.00;
        else if (sqft_range === "1001-1500") totalExtras += 125.00;
        else if (sqft_range === "1501-2200") totalExtras += 175.00;
        else totalExtras += 200.00;
      }
      else if (extra === "kitchen_cabinets") {
        if (["≤700", "700-1000"].includes(sqft_range)) totalExtras += 100.00;
        else if (sqft_range === "1001-1500") totalExtras += 150.00;
        else if (sqft_range === "1501-2200") totalExtras += 200.00;
        else totalExtras += 250.00;
      }
      else if (extra.startsWith("carpet_")) {
        if (extra.includes("bedroom")) {
          const match = extra.match(/carpet_(\d+)_bedroom/);
          if (match) {
            const count = parseInt(match[1]);
            totalExtras += count * 75;
            console.log(`Added carpet for ${count} bedroom(s): $${count * 75}`);
          }
        }
        else if (extra.includes("living_room")) {
          const match = extra.match(/carpet_(\d+)_living_room/);
          if (match) {
            const count = parseInt(match[1]);
            totalExtras += count * 85;
            console.log(`Added carpet for ${count} living room(s): $${count * 85}`);
          }
        }
        else if (extra.includes("hallway")) {
          const match = extra.match(/carpet_(\d+)_hallway/);
          if (match) {
            const count = parseInt(match[1]);
            totalExtras += count * 35;
            console.log(`Added carpet for ${count} hallway(s): $${count * 35}`);
          }
        }
        else if (extra.includes("staircase")) {
          const match = extra.match(/carpet_(\d+)_staircase/);
          if (match) {
            const count = parseInt(match[1]);
            totalExtras += count * 45;
            console.log(`Added carpet for ${count} staircase(s): $${count * 45}`);
          }
        }
      }
      else if (extra === "stain_removal") {
        totalExtras += 75;
        console.log('Added stain removal: $75');
      }
    });

    // Travel fees
    const travelFees = {
      "Saskatoon": 0,
      "Corman Park": 25,
      "Cathedral Bluffs": 25,
      "Grasswood Estates": 25,
      "Martensville": 45,
      "Warman": 50,
      "Dundurn": 60
    };
    let travelFee = travelFees[location] || 0;

    // Final calculation
    let subtotal = discountedBase + totalExtras + travelFee;
    let tax = subtotal * 0.11;
    let total = subtotal + tax;

    // Round to 2 decimals
    const finalSubtotal = Math.round(subtotal * 100) / 100;
    const finalTax = Math.round(tax * 100) / 100;
    const finalTotal = Math.round(total * 100) / 100;
    const finalBase = Math.round(base * 100) / 100;
    const finalDiscountedBase = Math.round(discountedBase * 100) / 100;
    const finalExtras = Math.round(totalExtras * 100) / 100;

    const resultData = {
      success: true,
      total: finalTotal,
      subtotal: finalSubtotal,
      tax: finalTax,
      base: finalBase,
      discounted_base: finalDiscountedBase,
      extras: finalExtras,
      travel: travelFee
    };

    // Log successful calculation
    console.log('Calculation successful! Returning:', resultData);

    // Return in Vapi's expected format
    return res.status(200).json({
      results: [{
        toolCallId: toolCallId,
        result: JSON.stringify(resultData)
      }]
    });
    
  } catch (error) {
    console.error('Calculation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Calculation failed'
    });
  }
}
