/**
 * API Client for GitHub Pages Frontend
 * Communicates with Google Apps Script backend via fetch
 */

const ApiClient = {
    /**
     * Generic POST request to Apps Script
     */
    async request(action, payload = {}) {
        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain',
                },
                body: JSON.stringify({ action, payload })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${action}):`, error);
            throw error;
        }
    },

    /**
     * Get all booking data
     */
    async getBookingData() {
        return await this.request('getBookingData');
    },

    /**
     * Create a new booking
     */
    async createBooking(data) {
        return await this.request('createBooking', data);
    },

    /**
     * Update existing booking
     */
    async updateBooking(data) {
        return await this.request('updateBooking', data);
    },

    /**
     * Upload payment slip
     */
    async uploadSlip(data, base64Data, mimeType) {
        return await this.request('uploadSlip', { data, base64Data, mimeType });
    },

    /**
     * Update distribution status (Admin only)
     */
    async updateDistributionStatus(id, status) {
        return await this.request('updateDistributionStatus', { id, status });
    },

    /**
     * Delete/Cancel booking
     */
    async deleteBooking(bookingId, pin) {
        return await this.request('deleteBooking', { bookingId, pin });
    },

    /**
     * Verify Admin PIN (Server-side validation)
     */
    async verifyAdminPin(pin) {
        return await this.request('verifyAdminPin', { pin });
    }
};
