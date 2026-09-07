import { Component } from '@angular/core';

@Component({
  selector: 'app-settings-credit-cards-page',
  standalone: true,
  template: `
    <div class="settings-page">
      <h1 class="settings-page-title">Credit Cards</h1>
      <div class="sb-empty">
        <svg width="40" height="40" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
          <path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm0,16V88H32V64Zm0,128H32V104H224v88Zm-16-24a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h32A8,8,0,0,1,208,168Zm-64,0a8,8,0,0,1-8,8H120a8,8,0,0,1,0-16h16A8,8,0,0,1,144,168Z" />
        </svg>
        <h3>No Credit Cards</h3>
        <p>Your credit cards will appear here after you complete a payment.</p>
      </div>
    </div>
  `,
})
export class SettingsCreditCardsPage {}
