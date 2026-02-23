import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface WelcomeEmailProps {
  firstName?: string;
  email: string;
}

export const WelcomeEmail = ({
  firstName,
  email,
}: WelcomeEmailProps) => {
  const previewText = firstName 
    ? `Welcome to Nexora Dental, ${firstName}!` 
    : `Welcome to Nexora Dental!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <svg 
              width="80" 
              height="80" 
              viewBox="0 0 2048 2048" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <g>
                <rect x="7.67" y="36.35" fill="#FEFEFE" width="2032.66" height="1912.57"/>
                <path fill="#6BB7AD" d="M274.54,799.16c-72.46-79-251.7-284.38-127.83-384.69c114.85-93,317.95,47.31,409.1,122.32    c212.27,174.71,395.82,404.01,578.24,609.33c110.86,124.78,228,264.68,354.71,372.51c58.24,49.56,122.34,94.11,193.15,123.74    l1.62,171.03c-1.59,2.28-4.32,1.9-6.71,2.19c-41.8,5.02-133.25,1.91-175.15-5.2c-121.07-20.55-195.68-95.36-260.66-193.02    c-104.34-156.81-198.33-325.19-300.6-484.44C799.99,914.27,602.8,610.31,373.05,481.59c-61.27-34.33-188.9-80.47-220.22,14.61    c-28.82,87.48,71.84,231.49,123.93,298.51C278.43,798.38,279.05,800.47,274.54,799.16z"/>
                <path fill="#6BB8AC" d="M1777.91,1217.26c-2.95-3.13-1.7-4.27,2.22-2.22c70.65,69.05,177.28,177.8,176.67,283.55    c-0.47,80.77-67.33,120.1-142.17,116.74c-176.39-7.93-395.91-217.82-514.92-339.07C1111.34,1084.34,941.9,875.01,760.5,676.81    c-94.98-103.77-198.62-216.98-320.72-288.64c-12.05-7.07-46.74-21.72-53.93-28.35c-5.27-4.86-14.61-26.28-22.41-35.41    c-32.51-38.04-79.89-53.69-125.97-67.62c-3.64-1.1-6.27,1.78-5.17-4.71l319.21-0.1c127.82,7.45,206.12,78.91,275.05,178.63    c112.79,163.16,211.37,341.61,321.93,507.59c131.35,197.2,322.09,454.51,529.51,573.55c60.08,34.48,199.86,90.21,228.96-8.65    C1932.8,1415.33,1833.09,1281.04,1777.91,1217.26z"/>
                <path fill="#6BB7AD" d="M383.51,641.26c5.02,55.39,6.43,111.02,4.21,166.9c110.84,73.75,200.61,174.83,279.4,281.24l3.14,0.99    c-0.03-35.46,0.01-70.76,0.13-105.92c1.35-8.18,10.92-9.6,8.9-0.72c1.91,0.57,1.86,1.32,0,2.22    c-10.84,178.07,6.78,363.51-2.13,541.62c-0.72,14.38-2.89,31.61-5.24,45.91c-23.09,140.54-147.89,243.25-290.62,237.53    l2.21-1274.29C389,571.56,389.06,606.44,383.51,641.26z"/>
                <path fill="#6BB7AD" d="M1388.72,892.56c0.5-118.64-7.75-251.35,0.02-368.04c10.12-151.88,142.71-270.32,293.55-270.24    c0.14,59.68-0.18,119.42-0.1,179.13c0.32,240.67,0.21,482.64,0.09,723.79c-3.25-0.75-6.47-1.59-9.57-2.74    c-3.08-1.14-6.09-2.31-8.72-4.05C1560.71,1082.06,1462.1,989.27,1388.72,892.56z"/>
                <path fill="#5CA499" d="M1388.72,892.56c4.62,0.08,9.39,7.62,12.27,11.1c80.52,97.27,175.42,184.6,281.29,253.55    c-0.03,54.82,0.08,109.75,0,164.57c-5.93-1.52-12.04-3.16-17.19-6.59c-21.9-14.58-43.2-32.3-63.46-49.2    c-74.63-62.22-140.88-133.86-205.21-206.4l-1,141.67l-4.47,2.64c-3.69-2.32-2.22-8.44-2.26-12.2    c-0.61-49.22,1.53-98.92-1.16-147.84c-4.16-3.84-6.54-9.08-9.92-13.43c-4.54-6.93,3.36-19.13,11.12-17.79    C1393.68,993.28,1388.61,918.47,1388.72,892.56z"/>
                <path fill="#5BA499" d="M383.51,641.26c2.97,0.83,5.91,1.74,8.71,2.96c2.77,1.21,5.48,2.44,7.75,4.21    c106.8,83.11,196.38,196.02,277.1,301.95c3.17,3.99,7.19,10.6,11.12,15.57c6.92,8.52,1.18,20.48-8.9,17.79    c-5.94-4.25-4.22-1.85-4.45,3.3c-1.79,39.55,2.24,79.52-1.1,119C592.63,993.62,498.93,888.5,383.97,809.83    C383.2,753.69,383.42,697.42,383.51,641.26z"/>
                <path fill="#44827A" d="M1682.28,1321.78c-0.06,41.17,5.12,102.87,0,141.26c-0.41,3.09,1.22,3.85-3.3,3.27    c-109.98-70.78-203.29-163.64-288.03-262.4l1.1-155.66C1480.36,1147.75,1571.9,1246.23,1682.28,1321.78z"/>
                <path fill="#43837B" d="M677.07,950.39c-0.15-0.19-2.87,0.41-4.47-1.59c-87.9-110.07-176.25-221.55-289.09-307.53    c0.06-34.81-0.04-69.71,0-104.52l53.18,34.66c90.89,68.55,167.99,152.82,239.23,241.14L677.07,950.39z"/>
                <path fill="#6DB0A6" d="M830.52,1170.55c1.95,3.34,1.27,4.35-2.22,2.22c-46.72-64.57-94.72-128.31-149-186.81    c0.29-0.66-0.32-1.72,0-2.22c2.69-4.26,11.79-7.73,8.9-17.79C741.09,1032.84,784.22,1099.35,830.52,1170.55z"/>
                <path fill="#6DAEA6" d="M1388.72,1012.66c-0.26,1.03-10.42,13.39-11.12,17.79c-45.43-58.43-97.72-112.76-137.88-175.69    c-1.95-4.56-1.21-6.05,2.22-4.45c42.89,52.68,91.3,107.29,137.79,156.88C1382.29,1009.91,1384.62,1012.55,1388.72,1012.66z"/>
                <path fill="#A1BEBA" d="M1241.94,850.31l-2.22,4.45l-35.56-51.15C1206.96,800.54,1239.19,846.93,1241.94,850.31z"/>
                <path fill="#97B8B5" d="M276.76,794.71l31.11,40.03c-10.31-9.13-20.81-18.72-30.16-28.85c-2.32-2.52-2.66-6.17-3.18-6.73    L276.76,794.71z"/>
                <path fill="#A1BCB8" d="M830.52,1170.55c2.83,4.35,29.21,37.23,26.67,40.03c-12.54-9.77-19.71-25.12-28.89-37.81L830.52,1170.55z"/>
                <path fill="#B0C8C5" d="M1780.13,1215.03l-2.22,2.22c-7.13-8.24-18.7-16.09-24.46-26.67    C1757.01,1187.41,1777.09,1212.06,1780.13,1215.03z"/>
              </g>
            </svg>
          </Section>

          <Heading style={h1}>
            {firstName ? `Welcome, ${firstName}!` : 'Welcome!'}
          </Heading>

          <Text style={text}>
            Thank you for joining Nexora Dental, the all-in-one platform for managing your dental practice's referral networks and marketing campaigns.
          </Text>

          <Text style={text}>
            Here's what you can do with Nexora:
          </Text>

          <Section style={features}>
            <Text style={featureItem}>✓ Track patient referrals from offices and sources</Text>
            <Text style={featureItem}>✓ Discover nearby dental offices and build relationships</Text>
            <Text style={featureItem}>✓ Create and manage marketing campaigns</Text>
            <Text style={featureItem}>✓ Monitor your practice analytics in real-time</Text>
            <Text style={featureItem}>✓ AI-powered insights and assistance</Text>
          </Section>

          <Section style={buttonContainer}>
            <Link
              href="https://nexoradental.lovable.app"
              target="_blank"
              style={button}
            >
              Get Started
            </Link>
          </Section>

          <Text style={text}>
            If you have any questions or need assistance, our support team is here to help.
          </Text>

          <Text style={footer}>
            Best regards,
            <br />
            The Nexora Dental Team
            <br />
            <Link
              href="mailto:admin@nexoradental.com"
              style={{ ...link, color: '#6BB7AD' }}
            >
              admin@nexoradental.com
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
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
  padding: '32px 0',
  textAlign: 'center' as const,
}

const h1 = {
  color: '#333',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '16px 0',
  padding: '0 48px',
  textAlign: 'center' as const,
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
  padding: '0 48px',
}

const features = {
  padding: '0 48px',
  margin: '24px 0',
}

const featureItem = {
  color: '#555',
  fontSize: '15px',
  lineHeight: '28px',
  margin: '4px 0',
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
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
}

const link = {
  color: '#6BB7AD',
  textDecoration: 'underline',
}

const footer = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '32px 0 0',
  padding: '0 48px',
}
