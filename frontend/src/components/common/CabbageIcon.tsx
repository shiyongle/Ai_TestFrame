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
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="TouShiWenLu icon"
    >
      <rect width="64" height="64" rx="14" fill="#007AFF" />
      <path d="M18 22h28v6H35v24h-6V28H18z" fill="white" />
    </svg>
  );
};

export default CabbageIcon;
