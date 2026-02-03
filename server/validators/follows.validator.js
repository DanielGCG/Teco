const { z } = require('zod');

const userIdSchema = z.object({
    userId: z.string()
});

module.exports = {
    userIdSchema
};
