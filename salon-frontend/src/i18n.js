import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      nav: {
        home: "Home",
        salons: "Find Salons",
        login: "Login",
        register: "Register",
        dashboard: "Dashboard"
      },
      hero: {
        title: "Skip the queue. Visit your salon on time.",
        subtitle: "Digital tokens for modern men's salons. Track your position live and never wait in a crowded shop again.",
        cta: "Find a Salon Near Me"
      },
      home: {
        active_token: "Live Status",
        your_token: "Your Token",
        queue_ahead: "Queue Ahead",
        est_wait: "Est. Wait",
        featured: "Featured Salons",
        view_all: "View All"
      },
      auth: {
        welcome_back: "Welcome back",
        create_account: "Create your account",
        continue_google: "Continue with Google",
        or: "Or",
        sign_in_email: "Sign in with email",
        sign_up_email: "Sign up with email instead",
        email: "Email address",
        password: "Password",
        forgot_password: "Forgot password?",
        sign_in_btn: "Sign In",
        create_account_btn: "Create Account",
        no_account: "Don't have an account?",
        have_account: "Already have an account?",
        register_shop: "Partner with QueueCut"
      },
      findSalons: {
        search_placeholder: "Search salons by name...",
        highest_rated: "Highest Rated",
        shortest_queue: "Shortest Queue",
        nearest: "Nearest",
        open_now: "Open Now",
        closed: "Closed",
        min_wait: "min wait",
        no_salons: "No salons found matching your criteria"
      },
      salonDetails: {
        latest_reviews: "Latest Reviews",
        live_queue: "Live Queue",
        now_serving: "Now Serving",
        waiting: "Waiting",
        est_wait: "Est. Wait",
        get_token: "Get Token",
        salon_closed: "Salon is currently closed",
        opens_at: "Opens at",
        quick_info: "Quick Info",
        max_daily_tokens: "Max Daily Tokens",
        avg_service_time: "Avg Service Time",
        workers_available: "Workers Available"
      },
      token: {
        token_active: "Token Active",
        ready_status: "Ready for you",
        serving_now: "It's your turn!",
        completed: "Completed",
        cancelled: "Cancelled",
        wait_time: "Wait Time",
        queue_ahead: "Queue Ahead",
        people: "people",
        show_qr: "Show this to the barber",
        cancel_token: "Cancel Token",
        are_you_sure_cancel: "Are you sure you want to cancel?"
      }
    }
  },
  hi: {
    translation: {
      nav: {
        home: "होम",
        salons: "सैलून खोजें",
        login: "लॉग इन",
        register: "रजिस्टर",
        dashboard: "डैशबोर्ड"
      },
      hero: {
        title: "कतार छोड़ें। समय पर अपने सैलून जाएँ।",
        subtitle: "आधुनिक पुरुषों के सैलून के लिए डिजिटल टोकन। अपनी स्थिति को लाइव ट्रैक करें और कभी भी भीड़-भाड़ वाली दुकान में इंतजार न करें।",
        cta: "मेरे पास एक सैलून खोजें"
      },
      home: {
        active_token: "लाइव स्थिति",
        your_token: "आपका टोकन",
        queue_ahead: "आगे कतार",
        est_wait: "अनुमानित प्रतीक्षा",
        featured: "विशेष सैलून",
        view_all: "सभी देखें"
      },
      auth: {
        welcome_back: "वापसी पर स्वागत है",
        create_account: "अपना खाता बनाएं",
        continue_google: "Google के साथ जारी रखें",
        or: "या",
        sign_in_email: "ईमेल के साथ साइन इन करें",
        sign_up_email: "इसके बजाय ईमेल से साइन अप करें",
        email: "ईमेल पता",
        password: "पासवर्ड",
        forgot_password: "पासवर्ड भूल गए?",
        sign_in_btn: "साइन इन करें",
        create_account_btn: "खाता बनाएं",
        no_account: "क्या आपके पास खाता नहीं है?",
        have_account: "क्या आपके पास पहले से एक खाता है?",
        register_shop: "QueueCut के साथ पार्टनर बनें"
      },
      findSalons: {
        search_placeholder: "नाम से सैलून खोजें...",
        highest_rated: "सबसे अधिक रेटेड",
        shortest_queue: "सबसे छोटी कतार",
        nearest: "निकटतम",
        open_now: "अभी खुला है",
        closed: "बंद",
        min_wait: "मिनट प्रतीक्षा",
        no_salons: "आपके मानदंडों से मेल खाने वाले कोई सैलून नहीं मिले"
      },
      salonDetails: {
        latest_reviews: "नवीनतम समीक्षाएं",
        live_queue: "लाइव कतार",
        now_serving: "अभी सेवा दे रहे हैं",
        waiting: "प्रतीक्षारत",
        est_wait: "अनुमानित प्रतीक्षा",
        get_token: "टोकन प्राप्त करें",
        salon_closed: "सैलून वर्तमान में बंद है",
        opens_at: "खुलता है",
        quick_info: "त्वरित जानकारी",
        max_daily_tokens: "अधिकतम दैनिक टोकन",
        avg_service_time: "औसत सेवा समय",
        workers_available: "उपलब्ध कर्मचारी"
      },
      token: {
        token_active: "टोकन सक्रिय है",
        ready_status: "आपके लिए तैयार",
        serving_now: "अब आपकी बारी है!",
        completed: "पूरा हुआ",
        cancelled: "रद्द",
        wait_time: "प्रतीक्षा का समय",
        queue_ahead: "आगे की कतार",
        people: "लोग",
        show_qr: "यह नाई को दिखाएं",
        cancel_token: "टोकन रद्द करें",
        are_you_sure_cancel: "क्या आप वाकई रद्द करना चाहते हैं?"
      }
    }
  },
  ta: {
    translation: {
      nav: {
        home: "முகப்பு",
        salons: "சலூன்களை தேடு",
        login: "உள்நுழைக",
        register: "பதிவு செய்க",
        dashboard: "டாஷ்போர்டு"
      },
      hero: {
        title: "வரிசையைத் தவிர்க்கவும். உங்கள் சலூனுக்கு சரியான நேரத்தில் செல்லுங்கள்.",
        subtitle: "நவீன ஆண்கள் சலூன்களுக்கான டிஜிட்டல் டோக்கன்கள். உங்கள் நிலையை நேரலையில் கண்காணிக்கவும், கூட்ட நெரிசலான கடையில் மீண்டும் காத்திருக்க வேண்டாம்.",
        cta: "எனக்கு அருகில் ஒரு சலூனைக் கண்டுபிடி"
      },
      home: {
        active_token: "நேரலை நிலை",
        your_token: "உங்கள் டோக்கன்",
        queue_ahead: "முன்னால் உள்ள வரிசை",
        est_wait: "காத்திருப்பு நேரம்",
        featured: "சிறப்பு சலூன்கள்",
        view_all: "அனைத்தையும் பார்"
      },
      auth: {
        welcome_back: "மீண்டும் வருக",
        create_account: "உங்கள் கணக்கை உருவாக்கவும்",
        continue_google: "Google மூலம் தொடரவும்",
        or: "அல்லது",
        sign_in_email: "மின்னஞ்சல் மூலம் உள்நுழைக",
        sign_up_email: "மின்னஞ்சல் மூலம் பதிவு செய்க",
        email: "மின்னஞ்சல் முகவரி",
        password: "கடவுச்சொல்",
        forgot_password: "கடவுச்சொல்லை மறந்துவிட்டீர்களா?",
        sign_in_btn: "உள்நுழைக",
        create_account_btn: "கணக்கை உருவாக்கு",
        no_account: "கணக்கு இல்லையா?",
        have_account: "ஏற்கனவே கணக்கு உள்ளதா?",
        register_shop: "QueueCut உடன் கூட்டாளியாக இருங்கள்"
      },
      findSalons: {
        search_placeholder: "பெயர் மூலம் தேடவும்...",
        highest_rated: "அதிக ரேட்டிங்",
        shortest_queue: "குறைந்த வரிசை",
        nearest: "அருகில் உள்ள",
        open_now: "இப்போது திறந்துள்ளது",
        closed: "மூடப்பட்டது",
        min_wait: "நிமிடம் காத்திருப்பு",
        no_salons: "பொருத்தமான சலூன்கள் இல்லை"
      },
      salonDetails: {
        latest_reviews: "சமீபத்திய மதிப்புரைகள்",
        live_queue: "நேரலை வரிசை",
        now_serving: "தற்போது சேவை",
        waiting: "காத்திருப்போர்",
        est_wait: "காத்திருப்பு நேரம்",
        get_token: "டோக்கன் பெறு",
        salon_closed: "சலூன் தற்போது மூடப்பட்டுள்ளது",
        opens_at: "திறக்கும் நேரம்",
        quick_info: "விரைவு தகவல்",
        max_daily_tokens: "தினசரி அதிகபட்ச டோக்கன்கள்",
        avg_service_time: "சராசரி சேவை நேரம்",
        workers_available: "பணியாளர்கள்"
      },
      token: {
        token_active: "டோக்கன் செயலில் உள்ளது",
        ready_status: "உங்களுக்காக தயாராக உள்ளது",
        serving_now: "உங்கள் முறை!",
        completed: "முடிந்தது",
        cancelled: "ரத்து செய்யப்பட்டது",
        wait_time: "காத்திருப்பு நேரம்",
        queue_ahead: "முன்னால் உள்ள வரிசை",
        people: "நபர்கள்",
        show_qr: "இதை முடிதிருத்துபவரிடம் காட்டுங்கள்",
        cancel_token: "டோக்கனை ரத்து செய்",
        are_you_sure_cancel: "உறுதியாக ரத்து செய்ய வேண்டுமா?"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
