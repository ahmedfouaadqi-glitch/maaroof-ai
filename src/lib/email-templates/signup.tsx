import * as React from 'react'

import { Button, Link, Preview, Text } from '@react-email/components'
import { BrandShell, button, link, text } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <BrandShell
    title="Confirm your email"
    footerNote="If you didn't create an account, you can safely ignore this email."
  >
    <Preview>Confirm your email for {siteName}</Preview>
    <Text className="dm-text" style={text}>
      Thanks for signing up for{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      !
    </Text>
    <Text className="dm-text" style={text}>
      Please confirm your email address (
      <Link href={`mailto:${recipient}`} style={link}>
        {recipient}
      </Link>
      ) by clicking the button below:
    </Text>
    <Button style={button} href={confirmationUrl}>
      Verify Email
    </Button>
  </BrandShell>
)

export default SignupEmail
