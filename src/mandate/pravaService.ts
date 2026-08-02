import PravaPayments from 'pravapayments';

// Initialize the PravaPayments client
// Make sure to set PRAVA_SECRET_KEY in your environment
const pravaClient = new PravaPayments({
  bearerToken: process.env.PRAVA_SECRET_KEY || '',
  baseURL: process.env.PRAVA_API_BASE_URL || 'https://api.prava.space',
});

/**
 * Step 1: Create a Checkout Session to setup the mandate (save the card)
 * 
 * @param email The user's email address
 * @param productId The ID of the usage-based or on-demand product in Prava
 * @param returnUrl The URL to redirect to after successful authorization
 * @returns The checkout URL for the user to visit
 */
export async function createMandateCheckout(email: string, productId: string, returnUrl: string): Promise<string> {
  try {
    const session = await pravaClient.checkoutSessions.create({
      product_cart: [
        { product_id: productId, quantity: 1 }
      ],
      customer: { email },
      return_url: returnUrl,
    });

    return session.checkout_url;
  } catch (error) {
    console.error('Error creating Prava mandate checkout:', error);
    throw error;
  }
}

/**
 * Step 2: Charge the saved mandate (Zero-Click Charge)
 * 
 * @param subscriptionId The subscription ID generated from the mandate checkout
 * @param amountInCents The amount to charge the user in cents (e.g., 1500 = $15.00)
 * @param description A description of what this charge is for
 * @returns The charge response from Prava
 */
export async function chargeMandate(subscriptionId: string, amountInCents: number, description: string) {
  try {
    const charge = await pravaClient.subscriptions.charge({
      subscription_id: subscriptionId,
      amount: amountInCents,
      description: description,
    });

    return charge;
  } catch (error) {
    console.error('Error charging Prava mandate:', error);
    throw error;
  }
}
