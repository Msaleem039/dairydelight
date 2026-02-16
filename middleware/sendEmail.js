import nodemailer from 'nodemailer';
import ejs from 'ejs';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: 'armanlhr247@gmail.com',
        pass: 'Saleem4321@',
      },
    });

    let html = '';

    if (
      typeof options.templatePath === 'string' &&
      options.templatePath.trim() !== ''
    ) {
      const __filename = fileURLToPath(import.meta.url);
      const currentDirectory = path.dirname(__filename);
      const filePath = path.join(
        currentDirectory,
        '../template/email',
        options.templatePath
      );

      const template = await fs.readFile(filePath, 'utf-8');
      html = ejs.render(template, options.templateData || {});
    }

    const mailOptions = {
      from: '"Dairy Delight Cheese" <armanlhr247@gmail.com>',
      to: options.email,
      subject: options.subject,
      html,
      attachments: options.attachments,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
};

export default sendEmail;
