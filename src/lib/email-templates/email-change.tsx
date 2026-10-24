import * as React from 'react'

import { Button, Link, Preview, Text } from '@react-email/components'
import { BrandShell, button, link, text } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <BrandShell
    title="Confirm your email change"
    footerNote="If you didn't request this change, please secure your account immediately."
  >
    <Preview>Confirm your email change for {siteName}</Preview>
    <Text className="dm-text" style={text}>
      You requested to change your email address for {siteName} from{' '}
      <Link href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </Link>{' '}
      to{' '}
      <Link href={`mailto:${newEmail}`} style={link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Text className="dm-text" style={text}>
      Click the button below to confirm this change:
    </Text>
    <Button style={button} href={confirmationUrl}>
      Confirm Email Change
    </Button>
  </BrandShell>
)

export default EmailChangeEmail
