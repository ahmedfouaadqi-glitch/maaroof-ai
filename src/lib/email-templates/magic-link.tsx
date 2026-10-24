import * as React from 'react'

import { Button, Preview, Text } from '@react-email/components'
import { BrandShell, button, text } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <BrandShell
    title="Your login link"
    footerNote="If you didn't request this link, you can safely ignore this email."
  >
    <Preview>Your login link for {siteName}</Preview>
    <Text className="dm-text" style={text}>
      Click the button below to log in to {siteName}. This link will expire shortly.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Log In
    </Button>
  </BrandShell>
)

export default MagicLinkEmail
