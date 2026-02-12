import React from 'react';
import styles from './StopwatchLoader.module.css';

export default function StopwatchLoader({ size = 64, className }) {
    return (
        <div role="status" aria-label="טוען..." className={className}>
            <style>{`
                @keyframes spin-loader {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes press-btn {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(1px); }
                }
            `}</style>
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#181B34"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {/* כפתור עליון */}
                <g style={{ animation: 'press-btn 1.5s ease-in-out infinite', transformOrigin: '12px 3px' }}>
                    <path d="M10 3H14" />
                   
                </g>
                {/* טבעת */}
                <circle cx="12" cy="13" r="8" stroke="#6161FF" />
                {/* מחוג שעות - איטי */}
                <line
                    x1="12" y1="13" x2="12" y2="9"
                    style={{ animation: 'spin-loader 18s linear infinite', transformOrigin: '12px 13px' }}
                />
                {/* מחוג דקות - מהיר */}
                <line
                    x1="12" y1="13" x2="12" y2="10"
                    style={{ animation: 'spin-loader 1.5s linear infinite', transformOrigin: '12px 13px' }}
                />
            </svg>
        </div>
    );
}
