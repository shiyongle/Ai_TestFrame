import React from 'react';

interface CabbageIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const CabbageIcon: React.FC<CabbageIconProps> = ({ size = 22, className, style }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Blue cabbage icon"
    >
      <defs>
        <radialGradient id="cabbageCore" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 12.5) rotate(90) scale(9.8)">
          <stop offset="0%" stopColor="#EAF5FF" />
          <stop offset="60%" stopColor="#8CC3FF" />
          <stop offset="100%" stopColor="#3E87E8" />
        </radialGradient>
        <linearGradient id="leafL" x1="5.5" y1="6.2" x2="12.2" y2="18.2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A8D4FF" />
          <stop offset="100%" stopColor="#2E79DC" />
        </linearGradient>
        <linearGradient id="leafR" x1="18.5" y1="6.1" x2="11.8" y2="18.4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9FCEFF" />
          <stop offset="100%" stopColor="#2D73D3" />
        </linearGradient>
      </defs>

      <ellipse cx="12" cy="20.6" rx="4.8" ry="1.3" fill="#1B5BA61A" />

      <path
        d="M11.9 3.8C9.2 4.2 6.9 5.8 5.7 8.3C4.3 11.3 4.9 14.6 6.4 16.8C7.9 19 10.2 20.2 12 20.2C13.8 20.2 16 19 17.5 16.8C19.1 14.5 19.7 11.1 18.2 8.1C16.9 5.6 14.6 4.1 11.9 3.8Z"
        fill="url(#cabbageCore)"
        stroke="#1F67C8"
        strokeWidth="1.15"
      />

      <path
        d="M11.8 4.4C9.9 4.9 8.4 6.1 7.6 7.8C6.5 10 6.7 12.4 7.5 14.2C8.4 16.3 10.1 17.7 12 17.9"
        stroke="#E8F6FF"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M12.2 4.4C14.1 4.9 15.6 6.1 16.4 7.8C17.5 10 17.3 12.4 16.5 14.2C15.6 16.3 13.9 17.7 12 17.9"
        stroke="#D4ECFF"
        strokeWidth="1"
        strokeLinecap="round"
      />

      <path
        d="M6.4 9.4C5.3 10.5 4.8 12.3 5.1 14.3C5.4 16.3 6.6 17.8 8.1 18.8C7.1 17 6.5 15.2 6.5 13.2C6.4 11.8 6.4 10.6 6.4 9.4Z"
        fill="url(#leafL)"
        stroke="#2B70CB"
        strokeWidth="0.9"
      />
      <path
        d="M17.6 9.4C18.7 10.5 19.2 12.3 18.9 14.3C18.6 16.3 17.4 17.8 15.9 18.8C16.9 17 17.5 15.2 17.5 13.2C17.6 11.8 17.6 10.6 17.6 9.4Z"
        fill="url(#leafR)"
        stroke="#2B70CB"
        strokeWidth="0.9"
      />

      <path d="M12 7.1V18.1" stroke="#FFFFFFCC" strokeWidth="0.95" strokeLinecap="round" />
      <path d="M12 11C10.8 10.7 9.8 10 9.1 9.1" stroke="#FFFFFFAA" strokeWidth="0.85" strokeLinecap="round" />
      <path d="M12 12.3C13.2 12 14.2 11.3 14.9 10.4" stroke="#FFFFFFAA" strokeWidth="0.85" strokeLinecap="round" />
      <path d="M12 14.8C10.7 14.5 9.5 13.8 8.6 12.8" stroke="#FFFFFF99" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M12 16C13.3 15.7 14.5 15 15.4 14" stroke="#FFFFFF99" strokeWidth="0.8" strokeLinecap="round" />

      <path
        d="M10.8 19.7C11.2 20.5 11.6 21 12 21C12.4 21 12.8 20.5 13.2 19.7"
        stroke="#80B7F8"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default CabbageIcon;
