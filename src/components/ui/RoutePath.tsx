import React from 'react';

export default function RoutePath({
  path,
  gradientId = 'island-main-route',
}: {
  path: string;
  gradientId?: string;
}) {
  if (!path) return null;

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.48"
      />
      <path
        className="island-route"
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 4"
      />
    </>
  );
}
