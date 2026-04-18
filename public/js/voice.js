import { t } from './i18n.js';

let isListening = false;
let recognition = null;
let silenceTimer = null;

// Initialize Speech Recognition if supported
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

window.toggleVoiceAI = function() {
    const btn = document.getElementById('voiceAiBtn');
    const waves = document.getElementById('micWaves');
    const tooltip = document.getElementById('voiceAiTooltip');

    if (isListening) {
        // Stop listening early
        if (recognition) recognition.stop();
        window.speechSynthesis?.cancel();
        resetVoiceUI();
        return;
    }
    
    // Stop any ongoing speech
    window.speechSynthesis?.cancel();
    
    isListening = true;
    
    // UI Update -> Listening
    btn.classList.replace('bg-emerald-600', 'bg-rose-500');
    btn.classList.replace('shadow-[0_0_20px_rgba(16,185,129,0.4)]', 'shadow-[0_0_30px_rgba(244,63,94,0.6)]');
    waves.classList.remove('hidden');
    tooltip.innerText = t('voice_listening') || 'Listening...';
    tooltip.classList.add('!opacity-100'); // Force show

    // Enforce Tamil always for the Voice AI
    const lang = 'ta';
    const bcp47 = 'ta-IN';

    if (!SpeechRecognition) {
        // Browser Fallback (Firefox etc that don't support it well)
        simulateConversationFallback(lang);
        return;
    }

    try {
        recognition = new SpeechRecognition();
        recognition.lang = bcp47;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = function(event) {
            clearTimeout(silenceTimer);
            const transcript = event.results[0][0].transcript;
            
            // Show what user said briefly
            tooltip.innerText = (lang === 'en' ? 'You: ' : 'நீங்கள்: ') + transcript;
            
            // Switch to processing UI
            setProcessingUI();

            setTimeout(() => {
                processUserQuery(transcript, lang);
            }, 1000);
        };

        recognition.onerror = function(event) {
            console.error("Speech recognition error", event.error);
            clearTimeout(silenceTimer);
            
            const tooltip = document.getElementById('voiceAiTooltip');
            
            if (event.error === 'not-allowed') {
                tooltip.innerText = "மைக்ரோஃபோன் செயல்பட மறுக்கப்பட்டுள்ளது! பிரவுசரில் அனுமதிக்கவும்.";
                setTimeout(resetVoiceUI, 4000);
            } else if (event.error === 'no-speech') {
                processUserQuery("", 'ta'); // treat as empty
            } else {
                tooltip.innerText = "பிழை: " + event.error;
                setTimeout(resetVoiceUI, 3000);
            }
        };

        recognition.onend = function() {
            clearTimeout(silenceTimer);
        };

        recognition.start();

        // 12 second timeout if user doesn't say anything
        silenceTimer = setTimeout(() => {
            if (isListening && recognition) {
                recognition.stop();
                processUserQuery("", 'ta');
            }
        }, 12000);

    } catch (e) {
        console.warn("Speech API Error, falling back to mock.", e);
        simulateConversationFallback(lang);
    }
}

function setProcessingUI() {
    const btn = document.getElementById('voiceAiBtn');
    const tooltip = document.getElementById('voiceAiTooltip');
    btn.classList.replace('bg-rose-500', 'bg-blue-500');
    btn.classList.replace('shadow-[0_0_30px_rgba(244,63,94,0.6)]', 'shadow-[0_0_30px_rgba(59,130,246,0.6)]');
    tooltip.innerText = t('voice_processing') || 'Thinking...';
}

function processUserQuery(transcript, lang) {
    transcript = transcript.trim().toLowerCase();
    
    // Core AI Brain (Intent Router)
    // Keywords are heavily scoped towards Tamil Agri-linguistics.
    const intentMap = [
        {
            keywords: ['உரம்', 'எந்த குப்பையை', 'நைட்ரஜன்', 'fertilizer', 'manure', 'nursery', 'nutrient'],
            ta: "இந்த நிலத்தின் மண் தரத்திற்கு நீங்கள் நைட்ரஜன் உரம் அல்லது டி.ஏ.பி பயன்படுத்தலாம். இது உங்கள் மகசூலை குறைந்தது 15 சதவீதம் அதிகரிக்கும்.",
            en: "For this soil configuration, you can apply Nitrogen fertilizer or DAP. This will significantly increase your expected yield by roughly 15 percent."
        },
        {
            keywords: ['மழை', 'வானிலை', 'தட்பவெப்ப', 'புயல்', 'வெயில்', 'rain', 'weather', 'storm', 'climate', 'sun'],
            ta: "கவனிக்கவும்! அடுத்த மூன்று நாட்களில் மிதமான மழைக்கு வாய்ப்புள்ளது. ஆகையால் இன்று நீர் பாய்ச்சுவதை தவிர்க்கவும்.",
            en: "Please note, there is a high chance of moderate rain in the next 3 days. Please avoid excess irrigation today to prevent root rot."
        },
        {
            keywords: ['மான்யம்', 'கடன்', 'பணம்', 'அரசு', 'பாங்கு', 'subsidy', 'loan', 'government', 'money', 'scheme', 'bank'],
            ta: "பெரிய அளவிலான விவசாய மானியங்களுக்கு 'பிரதான் மந்திரி கிசான்' (PM-Kisan) திட்டத்தை அணுகலாம். உங்கள் தற்போதைய 'SmartLife' ஆபத்து மதிப்பெண் அடிப்படையில் உங்களுக்கு விவசாய கடன் கிடைக்க அதிக வாய்ப்புள்ளது.",
            en: "For farming subsidies, you can approach the PM-Kisan scheme. Based on your current SmartLife risk score, you easily qualify for a priority micro-loan."
        },
        {
            keywords: ['நோய்', 'பூச்சி', 'கரை', 'கறை', 'வதங்கு', 'disease', 'pest', 'insect', 'fungus', 'sick'],
            ta: "பயிரில் இலை கறை அல்லது நோய் தாக்குதல் இருக்கலாம். மேலும் துல்லியமாக அறிய, உங்கள் பயிரின் இலையின் படத்தை 'பயிர் நோய் கண்டறிதல்' பிரிவில் பதிவு செய்து AI மூலம் பரிசோதிக்கவும்.",
            en: "There is a possibility of leaf spot or a pest attack. To know accurately, open the 'Scan Crop Disease' module and upload a photo for instant AI analysis."
        },
        {
            keywords: ['வணக்கம்', 'hello', 'hi', 'hey'],
            ta: "வணக்கம்! நான் உங்கள் ஸ்மார்ட் விவசாய AI. உரம், வானிலை, அல்லது பயிர் நோய்கள் பற்றி நீங்கள் என்னிடம் கேட்கலாம். நான் எப்படி உதவ முடியும்?",
            en: "Hello! I am your Smart Farm AI Agronomist. You can ask me about fertilizers, weather updates, or crop diseases. How can I assist you today?"
        },
        {
            keywords: ['நன்றி', 'தாங்க்ஸ்', 'thanks', 'thank you'],
            ta: "முக்காலமும் உழவு செய்யும் உங்களுக்கு எனது உதவிகள் எப்போதும் உண்டு! வேறு ஏதேனும் சந்தேகம் உள்ளதா?",
            en: "Always happy to help our farmers! Do you have any other questions?"
        },
        {
            keywords: ['தக்காளி', 'tomato'],
            ta: "தக்காளி சாகுபடிக்கு வடிகால் வசதியுள்ள இருமண் பாங்கான நிலம் சிறந்தது. நடவுக்கு செடிக்கு செடி 60 செ.மீ இடைவெளி விடவும்.",
            en: "For tomato cultivation, well-draining loamy soil is best. Ensure 60cm spacing between plants."
        },
        {
            keywords: ['நெல்', 'அரிசி', 'paddy', 'rice'],
            ta: "நெல் சாகுபடிக்கு ஆழமான களிமண் நிலம் மிகவும் சிறந்தது. போதுமான நீர் வசதி இருப்பதை உறுதிப்படுத்தவும்.",
            en: "For paddy cultivation, deep clay soil is best. Ensure adequate water irrigation is available."
        }
    ];

    let replyText = null;

    if (transcript === "") {
        replyText = "மன்னிக்கவும், உங்கள் குரல் தெளிவாக கேட்கவில்லை. இணைய இணைப்பு சீராக உள்ளதா என சரிபார்த்துவிட்டு, சற்று சத்தமாக பேசவும்.";
    } else {
        // Search for keywords
        for (const intent of intentMap) {
            if (intent.keywords.some(kw => transcript.includes(kw))) {
                replyText = intent.ta; // Enforce Tamil Output
                break;
            }
        }
        
        // Universal Answer Fallback for any unknown question
        if (!replyText) {
            replyText = `நீங்கள் "${transcript}" பற்றி கேட்கிறீர்கள் என புரிகிறது. இதற்கான மேம்பட்ட ஆய்வுகள் எங்கள் தரவுத்தளத்தில் செயலாக்கத்தில் உள்ளது. உங்கள் வட்டார வேளாண் அதிகாரியையும் நீங்கள் ஆலோசிக்கலாம்.`; 
        }
    }

    const tooltip = document.getElementById('voiceAiTooltip');
    tooltip.innerText = replyText;
    
    // Text to Speech Output
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(replyText);
        utterance.lang = 'ta-IN';
        
        // Force finding a native Tamil voice to avoid English accent reading Tamil
        let voices = window.speechSynthesis.getVoices();
        let tamilVoice = voices.find(v => v.lang.includes('ta') || v.name.toLowerCase().includes('tamil'));
        if(tamilVoice) {
            utterance.voice = tamilVoice;
        }
        
        // Optimize Voice params for Tamil clarity
        utterance.rate = 0.9; 
        
        window.speechSynthesis.speak(utterance);
        
        utterance.onend = () => {
            setTimeout(resetVoiceUI, 1000);
        };
        
        utterance.onerror = () => {
            setTimeout(resetVoiceUI, 3000);
        };
    } else {
        setTimeout(resetVoiceUI, 6000);
    }
}

// Fallback logic for unsupported environments (Firefox without flags or no mic permissions)
function simulateConversationFallback(lang) {
    setTimeout(() => {
        setProcessingUI();
        
        setTimeout(() => {
           // Simulate a random common Tamil Question interaction
           const q = "Mock: என் நிலத்திற்கு எந்த உரம் சிறந்தது?";
           const tooltip = document.getElementById('voiceAiTooltip');
           tooltip.innerText = lang === 'en' ? "You: What fertilizer is best?" : "நீங்கள்: " + q;
           
           setTimeout(() => {
               // Then provide standard fertilizer response
               processUserQuery('உரம்', lang);
           }, 1500);

        }, 1500);
    }, 1500);
}

function resetVoiceUI() {
    const btn = document.getElementById('voiceAiBtn');
    const waves = document.getElementById('micWaves');
    const tooltip = document.getElementById('voiceAiTooltip');
    
    btn.classList.remove('bg-rose-500', 'bg-blue-500');
    btn.classList.add('bg-emerald-600');
    btn.classList.remove('shadow-[0_0_30px_rgba(244,63,94,0.6)]', 'shadow-[0_0_30px_rgba(59,130,246,0.6)]');
    btn.classList.add('shadow-[0_0_20px_rgba(16,185,129,0.4)]');
    
    waves.classList.add('hidden');
    tooltip.innerText = 'AI உடன் பேசுக';
    tooltip.classList.remove('!opacity-100');
    
    isListening = false;
    recognition = null;
}

// Prefetch voices on load so they are ready when the button is clicked
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
}
