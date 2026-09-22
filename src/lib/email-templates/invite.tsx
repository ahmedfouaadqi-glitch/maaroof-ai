import * as React from 'react'

import { Button, Link, Preview, Text } from '@react-email/components'
import { BrandShell, button, link, text } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <BrandShell
    title="You've been invited"
    footerNote="If you weren't expecting this invitation, you can safely ignore this email."
  >
    <Preview>You've been invited to join {siteName}</Preview>
    <Text className="dm-text" style={text}>
      You've been invited to join{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . Click the button below to accept the invitation and create your account.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accept Invitation
    </Button>
  </BrandShell>
)

export default InviteEmail
