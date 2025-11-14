const templates = {
  booking_confirmation: {
    subject: 'See you soon, {{firstName}} ✨',
    title: 'Your appointment is confirmed',
    body: [
      'Thanks for booking with Salon Glamour NC. We cannot wait to pamper you.',
      'Appointment: {{appointmentDate}} at {{appointmentTime}} with {{stylist}}.',
      'Need to make a change? Tap the button below or reply to this email.'
    ],
    cta: {
      label: 'View appointment',
      url: '{{bookingLink}}'
    }
  },
  no_show_recovery: {
    subject: 'Let’s get you back in, {{firstName}}',
    title: 'We missed you',
    body: [
      'We noticed you were not able to make it to your appointment. Life happens — here is an easy way to reschedule.',
      'Tap below to secure a new time or call (704) 320-2786 if you need help.'
    ],
    cta: {
      label: 'Reschedule',
      url: '{{bookingLink}}'
    }
  },
  default: {
    subject: 'A quick update from Salon Glamour',
    title: 'Salon Glamour NC',
    body: [
      'We have some news for you.',
      'Tap below to learn more or reply with questions.'
    ],
    cta: {
      label: 'Visit our site',
      url: 'https://salonglamournc.com'
    }
  }
};

export function getAutomationTemplate(type) {
  return templates[type] ?? templates.default;
}
