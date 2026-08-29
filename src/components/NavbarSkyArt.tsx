import React from 'react';

export const NavbarSkyArt: React.FC = () => {
  return (
    <div className="navbar-sky-canvas" aria-hidden="true">
      {/* 1. PIXEL STARS (NIGHT SKY - LEFT & CENTER-LEFT) */}
      <div className="pixel-stars-container">
        {/* Twinkling 4-point cross stars */}
        <span className="pixel-star star-cross star-1" style={{ left: '3%', top: '22%' }}>✦</span>
        <span className="pixel-star star-cross star-2" style={{ left: '7%', top: '58%' }}>✧</span>
        <span className="pixel-star star-cross star-3" style={{ left: '12%', top: '18%' }}>✦</span>
        <span className="pixel-star star-cross star-4" style={{ left: '17%', top: '68%' }}>✧</span>
        <span className="pixel-star star-cross star-5" style={{ left: '22%', top: '28%' }}>✦</span>
        <span className="pixel-star star-cross star-6" style={{ left: '27%', top: '52%' }}>✧</span>
        <span className="pixel-star star-cross star-7" style={{ left: '33%', top: '20%' }}>✦</span>
        <span className="pixel-star star-cross star-8" style={{ left: '38%', top: '64%' }}>✧</span>

        {/* Small 2px square pixel stars */}
        <span className="pixel-dot dot-1" style={{ left: '5%', top: '38%' }} />
        <span className="pixel-dot dot-2" style={{ left: '10%', top: '75%' }} />
        <span className="pixel-dot dot-3" style={{ left: '15%', top: '42%' }} />
        <span className="pixel-dot dot-4" style={{ left: '20%', top: '14%' }} />
        <span className="pixel-dot dot-5" style={{ left: '25%', top: '78%' }} />
        <span className="pixel-dot dot-6" style={{ left: '30%', top: '34%' }} />
        <span className="pixel-dot dot-7" style={{ left: '36%', top: '15%' }} />
        <span className="pixel-dot dot-8" style={{ left: '42%', top: '48%' }} />
      </div>

      {/* 2. PIXEL RETRO CLOUDS (TRANSITION ZONE) */}
      <div className="pixel-clouds-layer">
        {/* Cloud 1 */}
        <svg className="pixel-cloud cloud-left" viewBox="0 0 48 16" width="48" height="16">
          <path
            d="M8 8h32v8H8z M12 4h20v4H12z M16 0h12v4H16z"
            fill="rgba(255, 255, 255, 0.22)"
          />
        </svg>
        {/* Cloud 2 */}
        <svg className="pixel-cloud cloud-mid" viewBox="0 0 64 20" width="64" height="20">
          <path
            d="M10 10h44v10H10z M16 6h28v4H16z M22 2h16v4H22z"
            fill="rgba(255, 255, 255, 0.28)"
          />
        </svg>
        {/* Cloud 3 */}
        <svg className="pixel-cloud cloud-right" viewBox="0 0 52 18" width="52" height="18">
          <path
            d="M8 8h36v10H8z M14 4h24v4H14z M18 0h14v4H18z"
            fill="rgba(255, 255, 255, 0.35)"
          />
        </svg>
      </div>

      {/* 3. PIXEL ART BIRDS (DAYLIGHT SKY - RIGHT) */}
      <div className="pixel-birds-layer">
        {/* Bird 1 */}
        <svg className="pixel-bird bird-1" viewBox="0 0 16 8" width="16" height="8">
          <path
            d="M0 2h3v2H0z M3 0h3v2H3z M6 2h4v2H6z M10 0h3v2h-3z M13 2h3v2h-3z M7 4h2v2H7z"
            fill="#111111"
          />
        </svg>
        {/* Bird 2 */}
        <svg className="pixel-bird bird-2" viewBox="0 0 16 8" width="16" height="8">
          <path
            d="M0 2h3v2H0z M3 0h3v2H3z M6 2h4v2H6z M10 0h3v2h-3z M13 2h3v2h-3z M7 4h2v2H7z"
            fill="#111111"
          />
        </svg>
        {/* Bird 3 */}
        <svg className="pixel-bird bird-3" viewBox="0 0 14 7" width="14" height="7">
          <path
            d="M0 2h2v2H0z M2 0h3v2H2z M5 2h4v2H5z M9 0h3v2H9z M12 2h2v2h-2z M6 4h2v2H6z"
            fill="#222222"
          />
        </svg>
        {/* Bird 4 */}
        <svg className="pixel-bird bird-4" viewBox="0 0 12 6" width="12" height="6">
          <path
            d="M0 2h2v2H0z M2 0h2v2H2z M4 2h4v2H4z M8 0h2v2H8z M10 2h2v2h-2z"
            fill="#333333"
          />
        </svg>
      </div>

      {/* 4. PIXEL ART SUN (DAYLIGHT SKY - FAR RIGHT) */}
      <div className="pixel-sun-wrapper">
        <svg className="pixel-sun-svg" viewBox="0 0 40 40" width="40" height="40">
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

      {/* 5. SUBTLE PIXEL DITHERING GRID OVERLAY */}
      <div className="sky-dither-pattern" />
    </div>
  );
};
