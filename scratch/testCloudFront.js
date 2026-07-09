const S3Helper = require('../helpers/s3Helper');

async function test() {
    console.log("=== Testing S3Helper CloudFront URL Generation ===");
    
    // Test generatePreSignedUrl
    const url1 = await S3Helper.generatePreSignedUrl('staymaster/destination', 'destination_1.jpeg');
    console.log("Destination URL:", url1);
    
    const url2 = await S3Helper.generatePreSignedUrl('staymaster/property', '2/display_image.webp');
    console.log("Property URL:", url2);
    
    const url3 = await S3Helper.generatePreSignedUrl('staymaster', 'banners/test.png');
    console.log("Banner URL:", url3);
    
    // Test getSignedUrlPromise
    const url4 = await S3Helper.getSignedUrlPromise({
        Bucket: 'staymaster/blogs',
        Key: 'some_blog_image.jpg'
    });
    console.log("Blog Image URL:", url4);
    
    console.log("=== Test Completed ===");
}

test().catch(err => console.error(err));
