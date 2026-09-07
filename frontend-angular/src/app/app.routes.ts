import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { guestGuard } from './core/guest.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { AdminShellComponent } from './layout/admin-shell.component';
import { MarketingShellComponent } from './layout/marketing-shell.component';
import { LoginPage } from './pages/auth/login.page';
import { RegisterPage } from './pages/auth/register.page';
import { ForgotPasswordPage } from './pages/auth/forgot-password.page';
import { HomePage } from './pages/home.page';
import { AccountsWorkspaceComponent } from './pages/accounts/accounts-workspace.component';
import { AccountsRestorePage } from './pages/accounts-restore.page';
import { ChallengeRedirectPage } from './pages/challenge-redirect.page';
import { NewChallengePage } from './pages/new-challenge.page';
import { PayoutsPage } from './pages/payouts.page';
import { PayoutsRequestPage } from './pages/payouts-request.page';
import { CertificatesPage } from './pages/certificates.page';
import { CompetitionsPage } from './pages/competitions.page';
import { CompetitionDetailPage } from './pages/competition-detail.page';
import { LeaderboardsPage } from './pages/leaderboards.page';
import { NotificationsPage } from './pages/notifications.page';
import { AdminPage } from './pages/admin.page';
import { SettingsLayoutComponent } from './pages/settings/settings-layout.component';
import { SettingsProfilePage } from './pages/settings/settings-profile.page';
import { SettingsSecurityPage } from './pages/settings/settings-security.page';
import { SettingsVerifyPage } from './pages/settings/settings-verify.page';
import { SettingsPreferencesPage } from './pages/settings/settings-preferences.page';
import { SettingsPaymentHistoryPage } from './pages/settings/settings-payment-history.page';
import { SettingsFeatureSuggestionsPage } from './pages/settings/settings-feature-suggestions.page';
import { SettingsCryptoWalletsPage } from './pages/settings/settings-crypto-wallets.page';
import { SettingsBankAccountsPage } from './pages/settings/settings-bank-accounts.page';
import { SettingsCreditCardsPage } from './pages/settings/settings-credit-cards.page';
import { SettingsDiscordPage } from './pages/settings/settings-discord.page';
import { SettingsEarlyAccessPage } from './pages/settings/settings-early-access.page';
import { AffiliatePage } from './pages/affiliate.page';
import { EconomicCalendarPage } from './pages/economic-calendar.page';
import { ToolsPage } from './pages/tools.page';
import { ToolsRiskCalculatorPage } from './pages/tools-risk-calculator.page';
import { TradeCopierPage } from './pages/trade-copier.page';
import { CheckoutPage } from './pages/checkout.page';
import { PayConfirmoPage } from './pages/pay-confirmo.page';
import { GraphqlLabPage } from './pages/graphql-lab.page';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    component: RegisterPage,
    canActivate: [guestGuard],
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordPage,
    canActivate: [guestGuard],
  },
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [adminGuard],
    children: [{ path: '', component: AdminPage }],
  },
  {
    path: '',
    component: MarketingShellComponent,
    children: [
      { path: '', component: HomePage },
      { path: 'checkout/:productId', component: CheckoutPage },
      { path: 'pay/confirmo', component: PayConfirmoPage },
    ],
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', redirectTo: 'accounts', pathMatch: 'full' },
      { path: 'accounts/restore', component: AccountsRestorePage },
      { path: 'accounts', component: AccountsWorkspaceComponent },
      { path: 'accounts/:id', component: AccountsWorkspaceComponent },
      { path: 'challenges/:id', component: ChallengeRedirectPage },
      { path: 'new-challenge', component: NewChallengePage },
      { path: 'payouts/request', component: PayoutsRequestPage },
      { path: 'payouts', component: PayoutsPage },
      { path: 'certificates', component: CertificatesPage },
      { path: 'competitions', component: CompetitionsPage },
      { path: 'competitions/:id', component: CompetitionDetailPage },
      { path: 'leaderboards', component: LeaderboardsPage },
      { path: 'notifications', component: NotificationsPage },
      { path: 'economic-calendar', component: EconomicCalendarPage },
      { path: 'tools/risk-calculator', component: ToolsRiskCalculatorPage },
      { path: 'tools', component: ToolsPage },
      { path: 'trade-copier', component: TradeCopierPage },
      { path: 'affiliate', component: AffiliatePage },
      { path: 'graphql-lab', component: GraphqlLabPage },
      {
        path: 'settings',
        component: SettingsLayoutComponent,
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'profile' },
          { path: 'profile', component: SettingsProfilePage },
          { path: 'verify', component: SettingsVerifyPage },
          { path: 'security', component: SettingsSecurityPage },
          { path: 'bank-accounts', component: SettingsBankAccountsPage },
          { path: 'credit-cards', component: SettingsCreditCardsPage },
          { path: 'crypto-wallets', component: SettingsCryptoWalletsPage },
          { path: 'payment-history', component: SettingsPaymentHistoryPage },
          { path: 'discord', component: SettingsDiscordPage },
          { path: 'early-access', component: SettingsEarlyAccessPage },
          { path: 'feature-suggestions', component: SettingsFeatureSuggestionsPage },
          { path: 'preferences', component: SettingsPreferencesPage },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
