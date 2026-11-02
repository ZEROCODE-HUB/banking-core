# Balance Adjustments and Verification Codes

**Prepared for:** Alianza Capital
**Prepared by:** Engineering
**Date:** 2 November 2026
**Status:** Awaiting your approval on the four points in section 7. The server-side work is prepared but has not been enabled.

## 1. Why this note exists

Inside the client record there is a control called **"Novedad de saldo"**. It lets an administrator change the balance of a client's savings account by hand. Because it moves real money, it is protected by a six-digit verification code sent by email.

We reviewed that control and found that the code does not currently prove what the screen suggests it proves. This note explains the operation in plain terms, describes what we found, and sets out the decision we propose. We intend to proceed with the recommended option unless you object.

## 2. The use case

A "novedad de saldo" is a manual correction to a savings balance. It exists for cases that fall outside the normal deposit and withdrawal process: a transfer that arrived through another channel and was never registered, a historical balance that needs correcting, or an adjustment agreed with a client and documented by the bank. It is an exception procedure, not a routine transaction, and that is why it requires an additional control.

## 3. Who can use it and how

The control is available only to the super-administrator profile. It appears on the client detail page, inside the **Ahorro** tab, beside the specific savings line being reviewed. A client cannot use it on their own account, and an ordinary user cannot see it.

The administrator selects **Agregar saldo** or **Debitar saldo**, enters the amount and the reason, reviews a summary screen, and then receives a verification code by email. After entering the code, the adjustment is saved, the savings balance changes, and the client receives a confirmation email.

## 4. What we found

### 4.1 The verification code is not sent to the client

**Problem.** Every code, for every client, is sent to one fixed internal mailbox at the bank. The client receives only a confirmation email after the balance has already changed. The screen tells the administrator to check "your email", which reads as though the client were being asked to authorize the adjustment, but the client never sees the code.

**Correction.** We propose that the code continue to go to an internal mailbox, because the party at risk in this operation is the bank, and the purpose of the code is to make sure two employees are involved before money moves. We also propose that the wording on screen say plainly that the code goes to the operations mailbox, not to the client.

**Cost.** No new cost. The change is in wording and in where the confirmation is sent, not in infrastructure.

### 4.2 The code can be approved by the person performing the adjustment

**Problem.** The code is created in the administrator's own browser and checked in the same browser. It is never stored or verified on a server. Anyone who can operate the screen can read the code from the page and approve their own adjustment without opening the mailbox. The control therefore depends on nobody looking, rather than on a technical barrier.

**Correction.** The code should be created on the server, stored only in a protected form, tied to that specific adjustment, and checked on the server. It should expire after a short period, allow a limited number of attempts, and be usable once. This is the correction that turns the step from a habit into a control.

**Cost.** This is the largest part of the work, approximately one to two days of development. It requires one small additional database table and a server-side function. There is no additional licence cost; the email service is billed under the provider you already use or the free development account we select.

### 4.3 A debit can take an account below zero

**Problem.** The form checks that the amount is greater than zero and that a reason has been entered. It does not check the available balance, so a debit can leave an account with a negative balance.

**Correction.** The server should refuse any adjustment that would take the balance below zero, unless a specific exception is approved in advance. We recommend refusing it by default and recording the reason when an exception is granted.

**Cost.** Small. It is a check inside the same server operation and adds no infrastructure.

### 4.4 The balance change is not all-or-nothing

**Problem.** The adjustment is saved in two separate steps: first the transaction record, then the updated balance. If the second step fails, the system shows a recorded adjustment that never reached the balance, and the books disagree.

**Correction.** Both steps should happen together, so either the transaction and the new balance are both saved or neither is. This is standard database practice and removes a class of reconciliation errors.

**Cost.** Included in the server-side work described in 4.2.

## 5. The two possible controls

**Option A — Internal dual control (recommended).** The code goes to an operations mailbox that the administrator cannot open. A second employee retrieves the code and reads it to the administrator. The client is notified by email after the adjustment is saved. This protects the bank against a single person moving money alone, which is the risk this control was built for.

**Option B — Client authorization.** The code goes to the client's own email address, and the client reads it to the administrator or enters it. This protects the client against an unauthorized adjustment. It is slower, depends on the client being reachable at that moment, and does not protect the bank from an internal operator acting with the client's cooperation.

We recommend **Option A**, with an explicit notification to the client immediately afterwards. It matches how the control is used today, it keeps the operation inside the bank's own procedures, and it closes the gap that currently lets one person approve their own adjustment.

## 6. Our proposed decision

We intend to proceed as follows, unless you tell us otherwise:

1. Keep the verification code as an internal dual control, delivered to an operations mailbox.
2. Move generation and validation to the server, with expiry, attempt limits and single use.
3. Send the client a clear notification once the adjustment is complete.
4. Refuse debits that would take the balance below zero.
5. Save the transaction and the balance change together.
6. Correct the on-screen wording so it describes what actually happens.

## 7. What we need from you

To proceed we need four confirmations:

1. Do you agree that this control is internal dual control rather than client authorization?
2. Which mailbox should receive the codes, and can you confirm that the person performing the adjustment cannot open it?
3. Should the client be notified after every adjustment, or only for debits above a certain amount?
4. Should a negative balance ever be allowed, and if so, who may approve it?

## 8. Effort and timing

The work is approximately two days, including the server-side verification, the database safeguard and testing. It does not depend on the email provider decision, which remains separate. The code and the database migration are prepared, but neither has been enabled. We will apply the migration and turn the control on once you confirm the four points in section 7.

## 9. Summary

The operation is legitimate and necessary. The control around it is currently weaker than it appears, because the code is created and checked in the same browser and can be approved by the person making the change. The correction is contained, costs about two days, and does not require new software licences. Our recommendation is to keep it as an internal dual control, move the verification to the server, and notify the client after the fact.
