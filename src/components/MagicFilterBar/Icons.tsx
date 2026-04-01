'use client';

import React from 'react';

// Common icon wrapper for styling
const IconWrapper = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <svg 
        viewBox="0 0 24 24" 
        width="22" 
        height="22" 
        fill="currentColor" 
        style={{ verticalAlign: 'middle', display: 'inline-block' }}
        className={className}
    >
        {children}
    </svg>
);

export const IconDrink = () => (
    <IconWrapper>
        <path d="M19,3H5V5L12,12L19,5V3M5.66,5.16L12,11.5L18.34,5.16L5.66,5.16M12,14C10.5,14 8.5,14 7,15.5V17H17V15.5C15.5,14 13.5,14 12,14M18,19V21H6V19H18Z" />
    </IconWrapper>
);

export const IconSalad = () => (
    <IconWrapper>
        <path d="M12,2L14.41,4.41L12,6.83L9.59,4.41L12,2M12,22C6.48,22 2,17.52 2,12C2,6.48 6.48,2 12,2C17.52,2 22,6.48 22,12C22,17.52 17.52,22 12,22M12,20C16.42,20 20,16.42 20,12C20,7.58 16.42,4 12,4C7.58,4 4,7.58 4,12C4,16.42 7.58,20 12,20Z" />
    </IconWrapper>
);

export const IconPlate = () => (
    <IconWrapper>
        <path d="M11,9H9V2H7V9H5V2H3V9C3,11.12 4.66,12.84 6.75,12.97V22H8.25V12.97C10.34,12.84 12,11.12 12,9V2H11V9M16,6V14H18.5V22H21V2C18.24,2 16,4.24 16,6Z" />
    </IconWrapper>
);

export const IconLeaf = () => (
    <IconWrapper>
        <path d="M12,2C15.73,2 18.23,3.75 21,3C21,3 21,3 21,3C21,3.87 20.25,5.1 19.5,6C17.5,8.4 15.1,10.6 12.6,12.8C10,15.1 7.2,17.2 4.5,19.1C2.5,20.5 2,21.5 2,22V2C2,2 4,2 8,2C9.5,2 11,2 12,2Z" />
    </IconWrapper>
);

export const IconCake = () => (
    <IconWrapper>
        <path d="M12,6C11,6 10,6.5 9,7.5L3,13.5V20H21V13.5L15,7.5C14,6.5 13,6 12,6M12,10.8L15.2,14H8.8L12,10.8M12,8.3L15.3,11.6L16.2,12.5L18.4,14.6L19,15.3V18H5V15.3L5.6,14.6L7.8,12.5L8.7,11.6L12,8.3Z" />
    </IconWrapper>
);

// Add more icons here...
