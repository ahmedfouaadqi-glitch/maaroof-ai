import * as React from 'react'

import { Button, Preview, Text } from '@react-email/components'
import { BrandShell, button, text } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <BrandShell
    title="Reset your password"
    footerNote="If you didn't request a password reset, you can safely ignore this email. Your password will not be changed."
  >
    <Preview>Reset your password for {siteName}</Preview>
    <Text className="dm-text" style={text}>
      We received a request to reset your password for {siteName}. Click the button below to choose a
      new password.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Reset Password
    </Button>
  </BrandShell>
)

export default RecoveryEmail
