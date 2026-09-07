import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ChatWidgetComponent } from '../components/chat-widget.component';

/** Public marketing chrome — matches React AppChrome for `/`, checkout, pay, graphql-lab. */
@Component({
  selector: 'app-marketing-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet, ChatWidgetComponent],
  template: `
    <header class="top">
      <a routerLink="/" class="brand">PropFirm</a>
      <nav>
        <a routerLink="/">Catalog</a>
        <a routerLink="/accounts">Accounts</a>
        <a routerLink="/payouts">Payouts</a>
        <a routerLink="/admin">Admin</a>
        <a routerLink="/login">Login</a>
        <a routerLink="/graphql-lab">GraphQL</a>
      </nav>
    </header>
    <main class="main">
      <router-outlet />
    </main>
    <app-chat-widget />
  `,
})
export class MarketingShellComponent {}
