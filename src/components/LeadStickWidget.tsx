import React from 'react';
import { LeadStickProvider } from './chat/LeadStickContext';
import { LeadStickChat } from './chat/LeadStickChat';
import type { LeadStickConfig } from '../index';

export function LeadStickWidget(props: LeadStickConfig) {
  return (
    <LeadStickProvider config={props}>
      <div className="leadstick-widget">
        <LeadStickChat />
      </div>
    </LeadStickProvider>
  );
}
