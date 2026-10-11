import mongoose from 'mongoose';

// A lead submitted through the public enquiry form.
// claimedBy === null  -> public enquiry, visible to every counselor
// claimedBy === <id>  -> private enquiry, visible only to that counselor
const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    courseInterest: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    // "online" when filled from the circulated form, "counselor" when shared by a counselor after a call.
    source: { type: String, enum: ['online', 'counselor'], default: 'online' },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

enquirySchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Enquiry = mongoose.model('Enquiry', enquirySchema);
