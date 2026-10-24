import * as React from 'react'

import { Preview, Text } from '@react-email/components'
import { BrandShell, brand, text } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandShell
    title="Confirm reauthentication"
    footerNote="This code will expire shortly. If you didn't request this, you can safely ignore this email."
  >
    <Preview>Your verification code</Preview>
    <Text className="dm-text" style={text}>
      Use the code below to confirm your identity:
    </Text>
    <Text style={codeStyle}>{token}</Text>
  </BrandShell>
)

export default ReauthenticationEmail

const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '24px',
  letterSpacing: '3px',
  fontWeight: 'bold' as const,
  color: brand.accent,
  margin: '0 0 30px',
}
