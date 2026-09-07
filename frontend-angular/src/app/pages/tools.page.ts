import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tools-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="tools-page">
      <header class="tools-heading">
        <div class="tools-heading-row">
          <div class="tools-brand-lockup" aria-hidden>
            <span class="tools-brand-mark">PF</span>
            <span class="tools-brand-name">PropFirm</span>
          </div>
          <div class="tools-heading-rule"></div>
          <h1>Trading Tools</h1>
        </div>
        <p>Professional-grade tools to sharpen your trading edge.</p>
      </header>

      <section aria-label="Available tools">
        <div class="tools-grid">
          <a routerLink="/tools/risk-calculator" class="tools-card" aria-label="Risk Calculator">
            <div class="tools-card-header">
              <div class="tools-card-top">
                <span class="tools-card-icon">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                    <path d="M80,120h96a8,8,0,0,0,8-8V64a8,8,0,0,0-8-8H80a8,8,0,0,0-8,8v48A8,8,0,0,0,80,120Zm8-48h80v32H88ZM200,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V40A16,16,0,0,0,200,24Zm0,192H56V40H200ZM100,148a12,12,0,1,1-12-12A12,12,0,0,1,100,148Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,140,148Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,180,148Zm-80,40a12,12,0,1,1-12-12A12,12,0,0,1,100,188Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,140,188Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,180,188Z" />
                  </svg>
                </span>
                <span class="tools-badge">Beta</span>
              </div>
              <h2>Risk Calculator</h2>
              <p>Calculate position size based on your risk tolerance and stop loss distance.</p>
            </div>
            <div class="tools-card-actions">
              <span class="tools-open-btn">Open Tool</span>
            </div>
          </a>
        </div>
      </section>
    </div>
  `,
})
export class ToolsPage {}
