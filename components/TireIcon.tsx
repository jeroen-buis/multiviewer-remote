import React from 'react';

type TireIconProps = {
    compound: string;
    size?: number;
    className?: string;
    x?: number;
    y?: number;
};

const TireIcon: React.FC<TireIconProps> = ({ compound, size = 20, className = '', x, y }) => {
    const props = {
        width: size,
        height: size,
        viewBox: "0 0 32 32",
        className: `tire-icon ${className}`,
        x,
        y,
    };

    const getColors = () => {
        switch (compound) {
            case 'SOFT': return { ring: '#ff3b30' };
            case 'MEDIUM': return { ring: '#ffcc00' };
            case 'HARD': return { ring: 'white' };
            case 'INTERMEDIATE': return { ring: '#34c759' };
            case 'WET': return { ring: '#3478f6' };
            default: return { ring: '#8e8e93' }; // UNKNOWN
        }
    };

    const getLetter = () => {
        switch(compound) {
            case 'SOFT': return 'S';
            case 'MEDIUM': return 'M';
            case 'HARD': return 'H';
            case 'INTERMEDIATE': return 'I';
            case 'WET': return 'W';
            default: return '?';
        }
    }

    const { ring } = getColors();

    return (
        <svg {...props}>
            <circle cx="16" cy="16" r="15" fill="black" />
            <circle cx="16" cy="16" r="12" fill="none" stroke={ring} strokeWidth="4" />
            <text
              x="16"
              y="17.5"
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize="16"
              fontWeight="bold"
              fill="white"
              fontFamily="sans-serif"
            >
              {getLetter()}
            </text>
        </svg>
    );
};

export default TireIcon;