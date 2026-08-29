import React, { useState, useEffect } from 'react';
import { retroAudio } from '../audio/retroSynth';

interface CookieBannerProps {
  lang: 'cs' | 'en';
  onOpenDetails: () => void;
}

const COOKIE_TEXT = {
  cs: {
    tag: 'INFORMACE O COOKIES & HOSTINGU',
    text: 'Tento web využívá nezbytné technické cookies a analytické logy poskytovatelů Cloudflare Pages a Google Sites pro bezpečný a spolehlivý provoz CDN.',
    btnAccept: 'Rozumím a přijímám',
    btnDetails: 'Více informací',
  },
  en: {
    tag: 'COOKIES & HOSTING NOTICE',
    text: 'This website uses essential technical cookies and infrastructure traffic logs via Cloudflare Pages and Google Sites for secure, high-speed CDN delivery.',
    btnAccept: 'Accept & Close',
    btnDetails: 'Learn More',
  },
};

export const CookieBanner: React.FC<CookieBannerProps> = ({ lang, onOpenDetails }) => {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const accepted = localStorage.getItem('gamesky_cookie_consent');
    if (!accepted) {
      // Delay slightly for smooth page load
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('gamesky_cookie_consent', 'true');
    retroAudio.playBlip();
    setVisible(false);
  };

  if (!visible) return null;

  const t = COOKIE_TEXT[lang];

  return (
    <div className="cookie-banner-editorial">
      <div className="cookie-banner-content">
        <div className="cookie-tag-badge">🍪 {t.tag}</div>
        <p className="cookie-text-body">{t.text}</p>
      </div>

      <div className="cookie-actions-group">
        <button
          className="btn-cookie-details"
          onClick={() => {
            retroAudio.playBlip();
            onOpenDetails();
          }}
        >
          {t.btnDetails}
        </button>
        <button className="btn-cookie-accept" onClick={handleAccept}>
          ✓ {t.btnAccept}
        </button>
      </div>
    </div>
  );
};
