import React from 'react';

export const FullPageSkyBackground: React.FC = () => {
  return (
    <div className="fullpage-sky-bg" aria-hidden="true">
      {/* 1. PIXEL STARS (NIGHT SKY - LEFT HALF) */}
      <div className="fullpage-stars-container">
        {/* Large 4-point Cross Stars */}
        <span className="sky-star star-cross star-1" style={{ left: '3%', top: '8%' }}>✦</span>
        <span className="sky-star star-cross star-2" style={{ left: '7%', top: '22%' }}>✧</span>
        <span className="sky-star star-cross star-3" style={{ left: '12%', top: '14%' }}>✦</span>
        <span className="sky-star star-cross star-4" style={{ left: '18%', top: '35%' }}>✧</span>
        <span className="sky-star star-cross star-5" style={{ left: '5%', top: '48%' }}>✦</span>
        <span className="sky-star star-cross star-6" style={{ left: '15%', top: '62%' }}>✧</span>
        <span className="sky-star star-cross star-7" style={{ left: '9%', top: '78%' }}>✦</span>
        <span className="sky-star star-cross star-8" style={{ left: '22%', top: '88%' }}>✧</span>
        <span className="sky-star star-cross star-9" style={{ left: '28%', top: '12%' }}>✦</span>
        <span className="sky-star star-cross star-10" style={{ left: '32%', top: '45%' }}>✧</span>
        <span className="sky-star star-cross star-11" style={{ left: '25%', top: '68%' }}>✦</span>
        <span className="sky-star star-cross star-12" style={{ left: '36%', top: '82%' }}>✧</span>
        <span className="sky-star star-cross star-13" style={{ left: '42%', top: '25%' }}>✦</span>

        {/* Small 2px Pixel Dots */}
        <span className="sky-dot dot-1" style={{ left: '2%', top: '18%' }} />
        <span className="sky-dot dot-2" style={{ left: '6%', top: '38%' }} />
        <span className="sky-dot dot-3" style={{ left: '11%', top: '52%' }} />
        <span className="sky-dot dot-4" style={{ left: '16%', top: '82%' }} />
        <span className="sky-dot dot-5" style={{ left: '21%', top: '28%' }} />
        <span className="sky-dot dot-6" style={{ left: '27%', top: '56%' }} />
        <span className="sky-dot dot-7" style={{ left: '34%', top: '19%' }} />
        <span className="sky-dot dot-8" style={{ left: '38%', top: '72%' }} />
        <span className="sky-dot dot-9" style={{ left: '44%', top: '42%' }} />
        <span className="sky-dot dot-10" style={{ left: '4%', top: '92%' }} />
        <span className="sky-dot dot-11" style={{ left: '19%', top: '6%' }} />
        <span className="sky-dot dot-12" style={{ left: '31%', top: '95%' }} />
      </div>

      {/* 2. PIXEL CLOUDS (TRANSITION ZONE) */}
      <div className="fullpage-clouds-container">
        {/* Cloud 1 */}
        <svg className="sky-cloud cloud-pos-1" viewBox="0 0 64 20" width="76" height="24">
          <path
            d="M10 10h44v10H10z M16 6h28v4H16z M22 2h16v4H22z"
            fill="rgba(255, 255, 255, 0.2)"
          />
        </svg>
        {/* Cloud 2 */}
        <svg className="sky-cloud cloud-pos-2" viewBox="0 0 48 16" width="56" height="20">
          <path
            d="M8 8h32v8H8z M12 4h20v4H12z M16 0h12v4H16z"
            fill="rgba(255, 255, 255, 0.18)"
          />
        </svg>
        {/* Cloud 3 */}
        <svg className="sky-cloud cloud-pos-3" viewBox="0 0 80 24" width="96" height="28">
          <path
            d="M12 12h56v12H12z M20 6h40v6H20z M28 0h24v6H28z"
            fill="rgba(255, 255, 255, 0.24)"
          />
        </svg>
        {/* Cloud 4 */}
        <svg className="sky-cloud cloud-pos-4" viewBox="0 0 64 20" width="80" height="25">
          <path
            d="M10 10h44v10H10z M16 6h28v4H16z M22 2h16v4H22z"
            fill="rgba(255, 255, 255, 0.22)"
          />
        </svg>
      </div>

      {/* 3. PIXEL BIRDS (DAYLIGHT SKY - RIGHT HALF) */}
      <div className="fullpage-birds-container">
        {/* Flock Top */}
        <svg className="sky-bird bird-top-1" viewBox="0 0 16 8" width="18" height="9">
          <path d="M0 2h3v2H0z M3 0h3v2H3z M6 2h4v2H6z M10 0h3v2h-3z M13 2h3v2h-3z M7 4h2v2H7z" fill="rgba(17, 24, 39, 0.85)" />
        </svg>
        <svg className="sky-bird bird-top-2" viewBox="0 0 16 8" width="15" height="8">
          <path d="M0 2h3v2H0z M3 0h3v2H3z M6 2h4v2H6z M10 0h3v2h-3z M13 2h3v2h-3z M7 4h2v2H7z" fill="rgba(17, 24, 39, 0.75)" />
        </svg>
        <svg className="sky-bird bird-top-3" viewBox="0 0 14 7" width="13" height="7">
          <path d="M0 2h2v2H0z M2 0h3v2H2z M5 2h4v2H5z M9 0h3v2H9z M12 2h2v2h-2z M6 4h2v2H6z" fill="rgba(17, 24, 39, 0.65)" />
        </svg>

        {/* Flock Middle */}
        <svg className="sky-bird bird-mid-1" viewBox="0 0 16 8" width="18" height="9">
          <path d="M0 2h3v2H0z M3 0h3v2H3z M6 2h4v2H6z M10 0h3v2h-3z M13 2h3v2h-3z M7 4h2v2H7z" fill="rgba(17, 24, 39, 0.8)" />
        </svg>
        <svg className="sky-bird bird-mid-2" viewBox="0 0 14 7" width="14" height="7">
          <path d="M0 2h2v2H0z M2 0h3v2H2z M5 2h4v2H5z M9 0h3v2H9z M12 2h2v2h-2z M6 4h2v2H6z" fill="rgba(17, 24, 39, 0.7)" />
        </svg>

        {/* Flock Bottom */}
        <svg className="sky-bird bird-bot-1" viewBox="0 0 16 8" width="16" height="8">
          <path d="M0 2h3v2H0z M3 0h3v2H3z M6 2h4v2H6z M10 0h3v2h-3z M13 2h3v2h-3z M7 4h2v2H7z" fill="rgba(17, 24, 39, 0.75)" />
        </svg>
        <svg className="sky-bird bird-bot-2" viewBox="0 0 12 6" width="12" height="6">
          <path d="M0 2h2v2H0z M2 0h2v2H2z M4 2h4v2H4z M8 0h2v2H8z M10 2h2v2h-2z" fill="rgba(17, 24, 39, 0.6)" />
        </svg>
      </div>

      {/* 4. PIXEL ART SUN (DAYLIGHT SKY - TOP RIGHT) */}
      <div className="fullpage-sun-container">
        <svg className="fullpage-sun-svg" viewBox="0 0 40 40" width="56" height="56">
          {/* Sun Core */}
          <rect x="10" y="10" width="20" height="20" fill="#FFE600" />
          <rect x="12" y="8" width="16" height="24" fill="#FFE600" />
          <rect x="8" y="12" width="24" height="16" fill="#FFE600" />
          <rect x="14" y="14" width="12" height="12" fill="#FFF475" />

          {/* Stepped Pixel Rays */}
          <rect x="18" y="2" width="4" height="4" fill="#FFAA00" />
          <rect x="18" y="34" width="4" height="4" fill="#FFAA00" />
          <rect x="2" y="18" width="4" height="4" fill="#FFAA00" />
          <rect x="34" y="18" width="4" height="4" fill="#FFAA00" />

          {/* Diagonal Rays */}
          <rect x="6" y="6" width="4" height="4" fill="#FFAA00" />
          <rect x="30" y="6" width="4" height="4" fill="#FFAA00" />
          <rect x="6" y="30" width="4" height="4" fill="#FFAA00" />
          <rect x="30" y="30" width="4" height="4" fill="#FFAA00" />
        </svg>
      </div>

      {/* 5. RETRO CRT / DITHER GRID TEXTURE */}
      <div className="fullpage-dither-pattern" />
    </div>
  );
};
