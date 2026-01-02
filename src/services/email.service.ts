import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

/**
 * Initialize email transporter with Gmail
 */
function getTransporter(): Transporter {
    if (transporter) {
        return transporter;
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error('Email configuration missing. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
    }

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    return transporter;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: `"CupCount" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: '🔒 Reset your CupCount password',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; line-height: 1.6;">
                <h2 style="color: #d97706;">Password Reset Request</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password for your <strong>CupCount</strong> account.</p>
                <p>Click the button below to set a new password. This link will expire in 1 hour.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #d97706; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p style="color: #64748b; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">🍵 CupCount: Professional Shop Management</p>
            </div>
        `,
        text: `Reset your password for CupCount: ${resetLink}`
    };

    if (process.env.NODE_ENV === 'test') {
        console.log('[TEST] Skipping password reset email to:', email);
        return;
    }

    try {
        const transport = getTransporter();
        await transport.sendMail(mailOptions);
    } catch (error) {
        console.error('Failed to send password reset email:', error);
        throw new Error('Failed to send reset email.');
    }
}

/**
 * Send email verification link
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
        from: `"CupCount" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: '☘️ Verify your CupCount Account',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; line-height: 1.6;">
                <h2 style="color: #059669;">Welcome to CupCount!</h2>
                <p>Hello,</p>
                <p>Thank you for joining <strong>CupCount</strong>. Please verify your email address to activate your account and start managing your shop properly.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
                </div>
                <p style="color: #64748b; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">🍵 CupCount: Smart management for small businesses</p>
            </div>
        `,
        text: `Verify your email for CupCount: ${verificationLink}`
    };

    if (process.env.NODE_ENV === 'test') {
        console.log('[TEST] Skipping verification email to:', email);
        return;
    }

    try {
        const transport = getTransporter();
        await transport.sendMail(mailOptions);
    } catch (error) {
        console.error('Failed to send verification email:', error);
        throw new Error('Failed to send verification email.');
    }
}

/**
 * Verify email configuration (for testing)
 */
export async function verifyEmailConfig(): Promise<boolean> {
    try {
        const transport = getTransporter();
        await transport.verify();
        console.log('✅ Email service is ready');
        return true;
    } catch (error) {
        console.error('❌ Email service verification failed:', error);
        return false;
    }
}
