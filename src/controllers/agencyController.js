const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Agency = require("../models/Agency");
const Volunteer = require("../models/Volunteer");
const { geocodeAddress } = require("../utils/geocoding");
const { sendMail } = require("../utils/mailer");

// Simple helper to introduce an artificial delay before DB operations
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MILES_TO_METERS = 1609.34;

// ✅ 1. Invite Agency (Admin Only)
exports.inviteAgency = async (req, res) => {
    try {
        const { contact_email } = req.body;

        // Artificial delay before querying the database
        await delay(500);
        // Check if agency already exists
        const existingAgency = await Agency.findOne({ contact_email });
        if (existingAgency) {
            return res.status(400).json({ message: "Agency already invited" });
        }

        // Generate a temporary ID for the invitation link (before creating the agency)
        // We'll use this ID to create the agency after email is sent successfully
        const tempAgencyId = new mongoose.Types.ObjectId();
        
        // Build invitation link with the temporary ID
        const invitationBaseUrl =
            process.env.AGENCY_INVITE_BASE_URL || "http://localhost:3000/v/agency";
        const invitationLink = `${invitationBaseUrl}/${tempAgencyId}/onboarding`;

        // Prepare email content
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const logoUrl = process.env.LOGO_URL || `${frontendUrl}/logo.png`;

        // ✅ STEP 1: Send invitation email FIRST
        // Only proceed to create agency if email is sent successfully
        let mailResult;
        try {
            mailResult = await sendMail({
                to: contact_email,
                subject: "Agency Invitation - Foster Toys",
                text: `Hello there,\n\nYou have been invited to join Foster Toys as an agency partner. Please fill out your agency details using the link below:\n\n${invitationLink}\n\nThank you,\nThe Foster Toys Team`,
                html: `

                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>Agency Invitation</title>
                </head>
                
                <body style="margin:0; padding:0; background:#F4E8D5; font-family: Arial, sans-serif;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#F4E8D5">
                    <tr>
                      <td align="center" style="padding: 40px 20px 20px 20px;">
                        
                        <!-- MAIN CONTAINER -->
                        <table width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="#F4E8D5" style="max-width:600px;">
                          <tr>
                            <td align="center" style="padding-bottom: 30px;">
                              <!-- LOGO -->
                              <img src="${logoUrl}" 
                                   alt="Foster Toys Logo" 
                                   width="180"
                                   style="display:block; margin:0 auto;">
                            </td>
                          </tr>
                
                          <!-- CONTENT -->
                          <tr>
                            <td style="padding: 0 30px 20px 30px; color:#333; font-size:16px; line-height:24px;">
                              
                              <p>Hello there,</p>
                
                              <p>
                                You have been invited to join Foster Toys as an agency partner. 
                                Please click the button below to complete your onboarding and set up your agency account:
                              </p>
                
                              <!-- ONBOARDING BUTTON (shadcn button style) -->
                              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                                <tr>
                                  <td align="center">
                                    <a href="${invitationLink}" 
                                       style="display: inline-block; padding: 12px 24px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 16px; font-weight: 500; font-size: 14px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                                      Complete Onboarding
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              <p style="margin-top: 30px;">Thank you,<br>
                              The Foster Toys Team</p>
                
                            </td>
                          </tr>
                
                          <!-- FOOTER -->
                          <tr>
                            <td align="center" style="padding: 40px 30px 20px 30px; color:#555; font-size:12px; line-height:18px;">
                              
                              <strong>FOSTER TOYS, INC.</strong><br>
                              1100 11TH STREET, SACRAMENTO CA. 95814<br><br>
                              FOSTER TOYS, INC. IS A 501(c)3 TAX-EXEMPT<br>
                              NONPROFIT ORGANIZATION<br>
                              Tax ID 39-3621457<br><br>
                
                              ©2025 Foster Toys, Inc. All rights reserved
                
                            </td>
                          </tr>
                
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>                
                `,
            });

            console.log(`[inviteAgency] ✅ Email sent successfully to ${contact_email}`);
        } catch (sendError) {
            console.error("[inviteAgency] ❌ Error sending invitation email:", sendError);
            // If email fails, do NOT create the agency
            return res.status(500).json({ 
                message: "Failed to send invitation email. Agency was not invited.",
                error: sendError.message || "Unknown error sending email."
            });
        }

        // ✅ STEP 2: Only create and save agency if email was sent successfully
        const newAgency = new Agency({
            _id: tempAgencyId, // Use the same ID we used in the invitation link
            contact_email,
            status: "pending"
        });

        await newAgency.save();
        console.log(`[inviteAgency] ✅ Agency created with ID: ${newAgency._id}`);

        res.status(200).json({
            message: "Invitation sent successfully!",
            agency: newAgency,
            invitationLink,
            emailSent: true,
            messageId: mailResult?.messageId || null,
        });
    } catch (error) {
        console.error("[inviteAgency] ❌ Error in inviteAgency:", error);
        res.status(500).json({ 
            message: "Error sending invitation", 
            error: error.message || error 
        });
    }
};
exports.submitDetails = async (req, res) => {
    try {
        console.log("Received Request Body:", req.body); // Debugging step

        const id = req.body.agency_id || req.body.id || req.params.id || req.query.id; // Fix

        if (!id || id === "undefined") {
            return res.status(400).json({ message: "Missing or invalid agency ID in request" });
        }

        console.log("Extracted Agency ID:", id);

        const agency = await Agency.findById(id);
        if (!agency) return res.status(404).json({ message: "Agency not found" });

        console.log("Agency found:", agency);

        const {
            organization_name,
            contact_person_name,
            contact_phone,
            shipping_address,
            suite,
            state,
            zip_code,
            choose_password,
            confirm_password,
            amazon_private,
            amazon_public
        } = req.body;

        if (choose_password && choose_password !== confirm_password) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        if (choose_password) {
            const salt = await bcrypt.genSalt(10);
            agency.choose_password = await bcrypt.hash(choose_password, salt);
        }

        // Update only if new values are provided
        agency.organization_name = organization_name || agency.organization_name;
        agency.contact_person_name = contact_person_name || agency.contact_person_name;
        agency.contact_phone = contact_phone || agency.contact_phone;
        agency.shipping_address = shipping_address || agency.shipping_address;
        agency.suite = suite || agency.suite;
        agency.state = state || agency.state;
        agency.zip_code = zip_code || agency.zip_code;

        const addressFieldsProvided = [shipping_address, suite, state, zip_code].some((value) => value !== undefined);
        const fullAddress = [
            agency.shipping_address,
            agency.suite,
            agency.state,
            agency.zip_code
        ]
            .filter((item) => item && item.trim())
            .join(", ");

        if (addressFieldsProvided && fullAddress) {
            try {
                const { latitude, longitude, formattedAddress } = await geocodeAddress(fullAddress);
                agency.location = {
                    type: "Point",
                    coordinates: [longitude, latitude]
                };
                agency.geocoded_address = formattedAddress;
            } catch (geocodeError) {
                console.error("Geocoding failed:", geocodeError.message);
                // We don't fail the entire request if geocoding fails; we just log it.
            }
        }

        // Update amazon details only if provided
        if (amazon_private !== undefined) {
            agency.amazon_private = amazon_private;
        }
        if (amazon_public !== undefined) {
            agency.amazon_public = amazon_public;
        }

        if (agency.status === "pending") {
            agency.status = "review";
        }

        await agency.save();

        res.status(200).json({ message: "Agency details updated successfully!", agency });
    } catch (error) {
        console.error("Error in submitDetails API:", error);
        res.status(500).json({ message: "Error updating details", error: error.message });
    }
};
// ✅ 3. Review and Approve Agency (Admin)
exports.reviewAgency = async (req, res) => {
    try {
        const { agencyId, amazon_private, amazon_public } = req.body;

        console.log("Received Data:", req.body); // Debugging

        if (!agencyId) {
            return res.status(400).json({ message: "Agency ID is required" });
        }

        const agency = await Agency.findById(agencyId);
        if (!agency) return res.status(404).json({ message: "Agency not found" });

        agency.amazon_private = amazon_private;
        agency.amazon_public = amazon_public;
        agency.status = "active";

        await agency.save();

        res.status(200).json({ message: "Agency approved and activated!", agency });
    } catch (error) {
        console.error("Review Agency Error:", error);
        res.status(500).json({ message: "Error reviewing agency", error });
    }
};


// ✅ 4. Pause Agency (Admin)
exports.pauseAgency = async (req, res) => {
    try {
        const { agencyId } = req.body;

        const agency = await Agency.findById(agencyId);
        if (!agency) return res.status(404).json({ message: "Agency not found" });

        agency.status = agency.status === "paused" ? "active" : "paused"; // Toggle status

        await agency.save();

        res.status(200).json({ message: `Agency ${agency.status} successfully!`, agency });
    } catch (error) {
        res.status(500).json({ message: "Error pausing agency", error });
    }
};

// ✅ 5. Login Agency
exports.loginAgency = async (req, res) => {
    console.log("login api called")
    console.log("Request Body:", req.body);
    try {
        const { contact_email, choose_password } = req.body;

        // Artificial delay before querying the database
        await delay(500);
        // Check if email is already registered as a volunteer
        const existingVolunteer = await Volunteer.findOne({ contact_email });
        if (existingVolunteer) {
            return res.status(400).json({ message: "Email is already registered as a volunteer" });
        }

        // Artificial delay before querying the database
        await delay(500);
        // Find agency by email
        const agency = await Agency.findOne({ contact_email: new RegExp(`^${contact_email}$`, "i") });
        console.log("Agency Found:", agency);
        if (!agency) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
   
        // Allow login for active, paused, and review status
        // Review status agencies will be redirected to review screen on frontend
        const allowedStatuses = ["active", "paused", "review"];
        console.log("🔍 Agency Status Check:", {
            status: agency.status,
            statusType: typeof agency.status,
            isAllowed: allowedStatuses.includes(agency.status)
        });
        
        if (!allowedStatuses.includes(agency.status)) {
            console.log("❌ Blocking login - status not allowed:", agency.status);
            return res.status(403).json({ message: "Your account is not active yet. Please wait for admin to approval." });
        }
        
        console.log("✅ Status check passed, proceeding with password verification");
        console.log("Input Password:", choose_password);
        console.log("Stored Hashed Password:", agency.choose_password);
        // Compare hashed passwords
        const isMatch = await bcrypt.compare(choose_password, agency.choose_password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

      // Generate JWT Token
      const token = jwt.sign({ id: agency._id, contact_email: agency.contact_email }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.cookie('x-auth-tk', token, {
          httpOnly: true, // ✅ Prevents JavaScript access (XSS protection)
          sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // ✅ Cross-origin support in production
          secure: process.env.NODE_ENV === 'production', // ✅ HTTPS only in production
          path: '/',
      });
      res.status(200).json({ message: 'Login successful', token, id:agency._id });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
// ✅ 6. Get All Agencies
exports.getAllAgencies = async (req, res) => {
    try {
        const agencies = await Agency.find();
        res.status(200).json({ message: "All agencies retrieved successfully", agencies });
    } catch (error) {
        res.status(500).json({ message: "Error fetching agencies", error });
    }
};

exports.filterAgenciesByRadius = async (req, res) => {
    try {
        const {
            latitude,
            longitude,
            radiusMiles = 30,
            address,
            zip_code: zipCode,
        } = req.query;

        let lat = latitude ? parseFloat(latitude) : undefined;
        let lng = longitude ? parseFloat(longitude) : undefined;
        let geocodeSucceeded = false;

        // Try to geocode if coordinates not provided
        if ((!lat || Number.isNaN(lat)) || (!lng || Number.isNaN(lng))) {
            const addressToGeocode = address || zipCode;
            if (!addressToGeocode) {
                return res.status(400).json({ message: "Provide either latitude/longitude or an address/zip_code to geolocate." });
            }
            try {
                const geocodeResult = await geocodeAddress(addressToGeocode);
                lat = geocodeResult.latitude;
                lng = geocodeResult.longitude;
                geocodeSucceeded = true;
                console.log(`Geocoded "${addressToGeocode}" to coordinates: [${lng}, ${lat}]`);
            } catch (geocodeError) {
                console.error("Geocoding failed:", geocodeError.message);
                // If geocoding fails and we have a zip code, we can still search by zip code
                if (!zipCode) {
                    return res.status(400).json({ 
                        message: "Failed to geocode the provided address/zip code. Please provide valid coordinates or try a different zip code." 
                    });
                }
                console.log(`Geocoding failed, will search by zip code only: "${zipCode}"`);
            }
        } else {
            geocodeSucceeded = true;
        }

        const distanceInMeters = parseFloat(radiusMiles) * MILES_TO_METERS;
        
        console.log(`Searching for agencies near coordinates: [${lng}, ${lat}] within ${radiusMiles} miles (${distanceInMeters}m)`);
        console.log(`Search zip code: ${zipCode || 'N/A'}`);

        // First, try to find agencies with geocoded coordinates using $geoNear (only if we have valid coordinates)
        let agencies = [];
        if (geocodeSucceeded && lat && lng) {
            try {
                agencies = await Agency.aggregate([
                    {
                        $geoNear: {
                            near: {
                                type: "Point",
                                coordinates: [lng, lat]
                            },
                            distanceField: "distanceInMeters",
                            maxDistance: distanceInMeters,
                            spherical: true,
                            query: { 
                                "location.coordinates": { $exists: true },
                                status: { $in: ["active", "review"] } // Only include active or review agencies
                            }
                        }
                    },
                    {
                        $addFields: {
                            distanceInMiles: { $divide: ["$distanceInMeters", MILES_TO_METERS] }
                        }
                    }
                ]);
                console.log(`Found ${agencies.length} agencies via geoNear search`);
            } catch (geoError) {
                console.error("Error in geoNear search:", geoError.message);
                // If geoNear fails (e.g., no 2dsphere index), continue with zip code search
            }
        }

        // If no geocoded agencies found (or geocoding failed) and zipCode is provided, search by zip code directly
        // This handles cases where agencies exist but don't have geocoded coordinates
        if (zipCode && (agencies.length === 0 || !geocodeSucceeded)) {
            const trimmedZipCode = zipCode.trim();
            // Normalize zip code: remove hyphens and extra spaces, take first 5 digits for US zip codes
            const normalizedZipCode = trimmedZipCode.replace(/[-\s]/g, '').substring(0, 5);
            console.log(`Searching by zip code: "${trimmedZipCode}" (normalized: "${normalizedZipCode}")`);
            
            // First, check if any agency exists with this zip code (for debugging)
            const allAgenciesWithZip = await Agency.find({
                $or: [
                    { zip_code: trimmedZipCode },
                    { zip_code: { $regex: new RegExp(`^\\s*${trimmedZipCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i') } },
                    { zip_code: { $regex: new RegExp(`^\\s*${normalizedZipCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } }
                ]
            }).lean();
            console.log(`Found ${allAgenciesWithZip.length} total agencies matching zip code patterns`);
            if (allAgenciesWithZip.length > 0) {
                console.log(`Agency statuses:`, allAgenciesWithZip.map(a => ({ id: a._id, zip_code: a.zip_code, status: a.status, hasLocation: !!a.location?.coordinates })));
            }
            
            // Search with multiple patterns: exact match, with whitespace variations, and with first 5 digits
            let zipCodeAgencies = await Agency.find({
                $or: [
                    { zip_code: trimmedZipCode },
                    { zip_code: { $regex: new RegExp(`^\\s*${trimmedZipCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') } },
                    { zip_code: { $regex: new RegExp(`^\\s*${normalizedZipCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } }
                ],
                status: { $in: ["active", "review"] }
            }).lean();
            
            console.log(`Found ${zipCodeAgencies.length} active/review agencies matching zip code "${trimmedZipCode}"`);

            // If we have search coordinates, calculate distance for zip code matches
            if (zipCodeAgencies.length > 0 && lat && lng && geocodeSucceeded) {
                const filteredAgencies = [];
                for (const agency of zipCodeAgencies) {
                    if (agency.location && agency.location.coordinates && agency.location.coordinates.length === 2) {
                        // Calculate distance using Haversine formula
                        const [agencyLng, agencyLat] = agency.location.coordinates;
                        const R = 6371000; // Earth radius in meters
                        const dLat = (agencyLat - lat) * Math.PI / 180;
                        const dLng = (agencyLng - lng) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(lat * Math.PI / 180) * Math.cos(agencyLat * Math.PI / 180) *
                            Math.sin(dLng / 2) * Math.sin(dLng / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const calculatedDistanceInMeters = R * c;
                        const calculatedDistanceInMiles = calculatedDistanceInMeters / MILES_TO_METERS;
                        
                        // Only include if within radius
                        if (calculatedDistanceInMiles <= radiusMiles) {
                            agency.distanceInMeters = calculatedDistanceInMeters;
                            agency.distanceInMiles = calculatedDistanceInMiles;
                            filteredAgencies.push(agency);
                        }
                    } else {
                        // No coordinates available - include it anyway for zip code match
                        // Set distance to 0 to indicate it's an exact zip code match
                        agency.distanceInMeters = 0;
                        agency.distanceInMiles = 0;
                        filteredAgencies.push(agency);
                    }
                }
                // Merge with any existing geo-based results, avoiding duplicates
                const existingIds = new Set(agencies.map(a => a._id.toString()));
                const newAgencies = filteredAgencies.filter(a => !existingIds.has(a._id.toString()));
                agencies = [...agencies, ...newAgencies];
            } else if (zipCodeAgencies.length > 0) {
                // No search coordinates or geocoding failed, just return zip code matches
                agencies = zipCodeAgencies.map(agency => ({
                    ...agency,
                    distanceInMiles: 0, // Set to 0 for exact zip code match when no coordinates
                    distanceInMeters: 0
                }));
            }
        }

        // Sort by distance if available
        agencies.sort((a, b) => {
            const distA = a.distanceInMiles || Infinity;
            const distB = b.distanceInMiles || Infinity;
            return distA - distB;
        });

        // Prevent caching (304 responses)
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        console.log(`Returning ${agencies.length} agencies total`);
        res.status(200).json({
            message: "Agencies filtered successfully",
            agencies
        });
    } catch (error) {
        console.error("Error filtering agencies:", error);
        res.status(500).json({ message: "Error filtering agencies", error: error.message });
    }
};

// ✅ 7. Get Agency by ID
exports.getAgencyById = async (req, res) => {
    try {
        const { id } = req.params;
        const agency = await Agency.findById(id);

        if (!agency) return res.status(404).json({ message: "Agency not found" });

        res.status(200).json({ message: "Agency retrieved successfully", agency });
    } catch (error) {
        res.status(500).json({ message: "Error fetching agency", error });
    }
};

