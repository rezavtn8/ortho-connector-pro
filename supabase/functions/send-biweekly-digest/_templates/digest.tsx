import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface DigestEmailProps {
  firstName?: string;
  dateRange: string;
  newPatients: number;
  visitsCompleted: number;
  officesAdded: number;
  campaignsSent: number;
  topOffices: Array<{ name: string; count: number }>;
  unsubscribeUrl: string;
}

export const DigestEmail = ({
  firstName,
  dateRange,
  newPatients,
  visitsCompleted,
  officesAdded,
  campaignsSent,
  topOffices,
  unsubscribeUrl,
}: DigestEmailProps) => {
  const previewText = `Your Practice Summary — ${dateRange}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>Nexora Dental</Text>
          </Section>

          <Heading style={h1}>
            {firstName ? `Hi ${firstName},` : 'Hi there,'}
          </Heading>

          <Text style={subtitle}>
            Your Practice Summary — {dateRange}
          </Text>

          <Section style={statsRow}>
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' }}>
              <tr>
                <td style={statCard}>
                  <Text style={statNumber}>{newPatients}</Text>
                  <Text style={statLabel}>New Patients</Text>
                </td>
                <td style={statCard}>
                  <Text style={statNumber}>{visitsCompleted}</Text>
                  <Text style={statLabel}>Visits Completed</Text>
                </td>
                <td style={statCard}>
                  <Text style={statNumber}>{officesAdded}</Text>
                  <Text style={statLabel}>Offices Added</Text>
                </td>
              </tr>
            </table>
          </Section>

          {topOffices.length > 0 && (
            <>
              <Hr style={divider} />
              <Heading as="h2" style={h2}>Top Referring Offices</Heading>
              <Section style={tableSection}>
                <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' }}>
                  <tr>
                    <td style={tableHeader}>Office Name</td>
                    <td style={{ ...tableHeader, textAlign: 'right' as const }}>Patients</td>
                  </tr>
                  {topOffices.map((office, i) => (
                    <tr key={i}>
                      <td style={tableCell}>{office.name}</td>
                      <td style={{ ...tableCell, textAlign: 'right' as const, fontWeight: 'bold' }}>{office.count}</td>
                    </tr>
                  ))}
                </table>
              </Section>
            </>
          )}

          {campaignsSent > 0 && (
            <>
              <Hr style={divider} />
              <Text style={text}>
                📣 You sent <strong>{campaignsSent} campaign{campaignsSent > 1 ? 's' : ''}</strong> in the last two weeks. Keep the momentum going!
              </Text>
            </>
          )}

          <Section style={buttonContainer}>
            <Link
              href="https://nexoradental.lovable.app"
              target="_blank"
              style={button}
            >
              View Full Dashboard
            </Link>
          </Section>

          <Hr style={divider} />

          <Text style={footer}>
            You're receiving this because you're subscribed to the Biweekly Practice Digest.
            <br />
            <Link href={unsubscribeUrl} style={unsubscribeLink}>
              Unsubscribe
            </Link>
            {' · '}
            <Link href="https://nexoradental.lovable.app/settings" style={unsubscribeLink}>
              Manage preferences
            </Link>
          </Text>

          <Text style={footer}>
            The Nexora Dental Team
            <br />
            <Link href="mailto:admin@nexoradental.com" style={{ color: '#6BB7AD' }}>
              admin@nexoradental.com
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default DigestEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
}

const logoSection = {
  padding: '32px 0 16px',
  textAlign: 'center' as const,
}

const logoText = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#6BB7AD',
  margin: '0',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  margin: '16px 0 4px',
  padding: '0 48px',
}

const subtitle = {
  color: '#666',
  fontSize: '16px',
  margin: '0 0 24px',
  padding: '0 48px',
}

const h2 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold' as const,
  margin: '24px 0 12px',
  padding: '0 48px',
}

const text = {
  color: '#333',
  fontSize: '15px',
  lineHeight: '26px',
  margin: '16px 0',
  padding: '0 48px',
}

const statsRow = {
  padding: '0 32px',
}

const statCard = {
  textAlign: 'center' as const,
  padding: '16px 8px',
  backgroundColor: '#f0faf8',
  borderRadius: '8px',
  width: '33%',
}

const statNumber = {
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#6BB7AD',
  margin: '0',
  lineHeight: '1.2',
}

const statLabel = {
  fontSize: '12px',
  color: '#666',
  margin: '4px 0 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}

const tableSection = {
  padding: '0 48px',
}

const tableHeader = {
  fontSize: '12px',
  color: '#999',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  padding: '8px 0',
  borderBottom: '1px solid #eee',
}

const tableCell = {
  fontSize: '14px',
  color: '#333',
  padding: '10px 0',
  borderBottom: '1px solid #f0f0f0',
}

const divider = {
  borderColor: '#eee',
  margin: '24px 48px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#6BB7AD',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
}

const footer = {
  color: '#999',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '16px 0 0',
  padding: '0 48px',
  textAlign: 'center' as const,
}

const unsubscribeLink = {
  color: '#999',
  textDecoration: 'underline',
}
