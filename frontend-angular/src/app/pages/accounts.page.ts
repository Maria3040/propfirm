import { Component } from '@angular/core';
import { AccountsWorkspaceComponent } from './accounts/accounts-workspace.component';

@Component({
  selector: 'app-accounts-page',
  standalone: true,
  imports: [AccountsWorkspaceComponent],
  template: `<app-accounts-workspace />`,
})
export class AccountsPage {}
