import React from 'react';

interface ValidumLogoProps {
  variant?: 'full' | 'mark-only' | 'horizontal';
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ValidumLogo: React.FC<ValidumLogoProps> = ({
  variant = 'full',
  theme = 'dark',
  size = 'md',
  className = '',
}) => {
  // Size dimensions
  const dimensions = {
    sm: { mark: 'w-6 h-6', text: 'text-base', sub: 'text-[7px]' },
    md: { mark: 'w-9 h-9', text: 'text-xl', sub: 'text-[9px]' },
    lg: { mark: 'w-12 h-12', text: 'text-2xl', sub: 'text-[10px]' },
    xl: { mark: 'w-16 h-16', text: 'text-4xl', sub: 'text-[12px]' },
  }[size];

  // Color theme overrides
  const navyColor = theme === 'dark' ? '#0f2537' : '#0f2537';
  const textColor = theme === 'dark' ? 'text-slate-100' : 'text-[#0f2537]';
  const subtextColor = theme === 'dark' ? 'text-slate-300' : 'text-[#1d3b54]';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      
      {/* Official Validum Isotype / Logo Mark SVG */}
      <div className={`relative flex-shrink-0 ${dimensions.mark}`}>
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Left Navy Arm of V */}
          <path
            d="M26 22C20.4772 22 16 26.4772 16 32V68C16 83.464 28.536 96 44 96C52.464 96 60.038 92.235 65.176 86.294L38.485 33.159C35.918 26.541 29.541 22 26 22Z"
            fill="#0f2537"
          />
          <path
            d="M28 20C21.3726 20 16 25.3726 16 32L16 66C16 81.464 28.536 94 44 94C51.684 94 58.625 90.902 63.666 85.861L34.12 30.12C31.846 24.124 29.5 20 28 20Z"
            fill="#112d45"
          />

          {/* Right Lime Green Arm of V */}
          <path
            d="M92 30C97.5228 30 102 34.4772 102 40V58C102 67.2424 96.4258 75.1824 88.4238 78.6855L64.2461 38.6855C68.6181 33.3135 75.1484 30 82.5 30H92Z"
            fill="#c4d600"
          />
          <path
            d="M90 28C96.6274 28 102 33.3726 102 40V56C102 65.2424 96.4258 73.1824 88.4238 76.6855L66.2461 39.6855C70.6181 34.3135 77.1484 28 84.5 28H90Z"
            fill="#d2e300"
          />

          {/* Smooth White Curved Separator Arc */}
          <path
            d="M58 88C72.3594 88 84 76.3594 84 62C84 57.5 82.8 53.3 80.7 49.6"
            stroke="#ffffff"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Typography / Wordmark */}
      {variant !== 'mark-only' && (
        <div className="flex flex-col justify-center text-left">
          <span
            className={`font-black font-sans tracking-tight leading-none ${textColor} ${dimensions.text}`}
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}
          >
            VALIDUM
          </span>
          <div className="flex items-center gap-1 mt-1">
            <div className="h-[2px] w-full bg-[#c4d600] rounded-full" />
            <span
              className={`font-bold font-mono uppercase tracking-[0.28em] shrink-0 ${subtextColor} ${dimensions.sub}`}
            >
              GRUPO EMPRESARIAL
            </span>
            <div className="h-[2px] w-full bg-[#c4d600] rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};
