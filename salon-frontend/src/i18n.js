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
