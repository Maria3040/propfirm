'use client';

import { useState } from 'react';

function ShieldIcon() {
  return (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.27,47,25.53a8,8,0,0,0,4.2,0c1-.26,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

export default function VerifySettingsPage() {
  const [started, setStarted] = useState(false);

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Account Verification</h1>

      <div className="sv-card">
        <div className="sv-card-top">
          <div className="sv-status-row">
            <div className="sv-status-lead">
              <span className="sv-status-icon">
                <ShieldIcon />
              </span>
              <div>
                <h3>Identity Verification Available</h3>
                <p>You can now verify your identity</p>
              </div>
            </div>
            <span className="sv-badge">{started ? 'In Progress' : 'Not Verified'}</span>
          </div>
        </div>

        <div className="sv-card-body">
          <div className="sv-start-panel">
            <div className="sv-start-inner">
              <h3>{started ? 'Verification Started' : 'Start Verification'}</h3>
              <p>
                {started
                  ? 'Upload a government ID when prompted. This is a demo flow — no documents are uploaded.'
                  : 'Verify your identity to unlock additional features'}
              </p>
              <button
                type="button"
                className="settings-save-btn sv-start-btn"
                onClick={() => setStarted(true)}
                disabled={started}
              >
                {started ? 'Verification Pending' : 'Start Verification'}
              </button>
            </div>
            <span className="sv-powered">
              <CheckIcon /> Powered by KYCAID
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
