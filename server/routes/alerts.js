import { Router } from 'express';

const router = Router();

// In-memory simulation of alert subscribers
const subscribers = [];

export default function() {
  router.post('/subscribe', (req, res) => {
    const { phone, cropId, sowingDate, language } = req.body;
    
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const sub = { 
        id: Date.now(), 
        phone, 
        cropId, 
        sowingDate, 
        language,
        timestamp: new Date().toISOString()
    };
    
    subscribers.push(sub);
    
    console.log(`\n📲 Reminders Registered for +91${phone}`);
    console.log(`   Crop: ${cropId} | Sowing: ${sowingDate}`);
    console.log(`   (SIMULATED: Twilio/WhatsApp Hook would go here)\n`);

    res.json({ success: true, message: 'Simulated alert registration successful' });
  });

  return router;
}
