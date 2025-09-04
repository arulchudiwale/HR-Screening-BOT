import React from 'react';

const Gauge = ({ value, maxValue, label, color = '#1d4ed8', trackColor = '#e5e7eb' }) => {
  // Calculate percentage (capped at 100%)
  const percentage = Math.min(100, (value / maxValue) * 100);
  
  // SVG parameters
  const size = 100; // Size of the gauge (increased from 80)
  const strokeWidth = 10; // Width of the gauge arc (increased from 8)
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Calculate the SVG arc path
  const startAngle = 180; // Start at bottom left (180 degrees)
  const endAngle = 0;   // End at bottom right (0 degrees)
  const angleRange = startAngle - endAngle;
  
  // Calculate the arc path for the value
  const valueAngle = startAngle - (percentage / 100) * angleRange;
  
  // Create the SVG arc paths
  const createArc = (startAngle, endAngle) => {
    const start = polarToCartesian(centerX, centerY, radius, startAngle);
    const end = polarToCartesian(centerX, centerY, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    
    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
  };
  
  // Helper function to convert polar coordinates to cartesian
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };
  
  // Create the background track arc (full semicircle)
  const trackPath = createArc(startAngle, endAngle);
  
  // Create the value arc (portion of the semicircle)
  const valuePath = createArc(startAngle, valueAngle);
  
  return (
    <div className="gauge-container">
      <svg width={size} height={size/2 + 5} viewBox={`0 0 ${size} ${size/2 + 5}`}>
        {/* Background track */}
        <path
          d={trackPath}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Value arc */}
        <path
          d={valuePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Value text */}
        <text
          x={centerX}
          y={centerY + 5}
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fill="#0f172a"
        >
          {value}/{maxValue}
        </text>
      </svg>
      <div className="gauge-label">{label}</div>
    </div>
  );
};

export default Gauge;