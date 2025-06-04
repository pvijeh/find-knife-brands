const fs = require('fs');
const path = require('path');

// Function to read and parse all JSON report files
function readAllReports() {
    const resultsDir = './results';
    const files = fs.readdirSync(resultsDir).filter(file => file.endsWith('.json'));
    
    const reports = [];
    
    files.forEach(file => {
        try {
            const filePath = path.join(resultsDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            reports.push(data);
        } catch (error) {
            console.error(`Error reading file ${file}:`, error.message);
        }
    });
    
    return reports;
}

// Function to extract model name from metadata
function extractModelName(metadata) {
    return metadata.model_name || metadata.model_used || 'Unknown Model';
}

// Function to assemble data for HTML table
function assembleTableData() {
    const reports = readAllReports();
    const tableData = [];
    
    reports.forEach(report => {
        const modelName = extractModelName(report.metadata);
        const totalCost = report.metadata.token_usage?.total_cost_credits || 0;
        const successRate = report.metadata.success_rate || '0%';
        const totalBrands = report.metadata.total_brands_processed || 0;
        
        // Process each brand result
        report.results.forEach(result => {
            tableData.push({
                model: modelName,
                brandName: result.brand_name,
                websiteUrl: result.website_url || 'Not Found',
                confidence: result.search_confidence || 'unknown',
                success: result.success,
                description: result.description || '',
                location: result.additional_info?.location || 'Unknown',
                specialties: result.additional_info?.specialties || '',
                notes: result.notes || '',
                tokenCost: result.token_usage?.cost || 0,
                totalTokens: result.token_usage?.total_tokens || 0
            });
        });
        
        // Add summary row for the model
        tableData.push({
            model: modelName,
            brandName: '--- MODEL SUMMARY ---',
            websiteUrl: `${report.metadata.successful_searches}/${totalBrands} found`,
            confidence: successRate,
            success: true,
            description: `Total cost: $${totalCost.toFixed(4)}`,
            location: '',
            specialties: '',
            notes: `Avg tokens per brand: ${report.metadata.token_usage?.average_tokens_per_brand || 0}`,
            tokenCost: totalCost,
            totalTokens: report.metadata.token_usage?.total_tokens || 0,
            isSummary: true
        });
    });
    
    return tableData;
}

// Function to generate HTML table
function generateHTMLTable(data) {
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Brand Website Search Results Analysis</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
            position: sticky;
            top: 0;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .summary-row {
            background-color: #e8f4f8 !important;
            font-weight: bold;
        }
        .confidence-high {
            background-color: #d4edda;
            color: #155724;
        }
        .confidence-medium {
            background-color: #fff3cd;
            color: #856404;
        }
        .confidence-low {
            background-color: #f8d7da;
            color: #721c24;
        }
        .url-found {
            color: #007bff;
        }
        .url-not-found {
            color: #dc3545;
            font-style: italic;
        }
        .model-name {
            font-weight: bold;
            color: #495057;
        }
        .description {
            max-width: 300px;
            word-wrap: break-word;
        }
        .notes {
            max-width: 250px;
            word-wrap: break-word;
            font-size: 0.9em;
        }
        .cost {
            text-align: right;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Brand Website Search Results Analysis</h1>
        <table>
            <thead>
                <tr>
                    <th>Model</th>
                    <th>Brand Name</th>
                    <th>Website URL</th>
                    <th>Confidence</th>
                    <th>Description</th>
                    <th>Location</th>
                    <th>Specialties</th>
                    <th>Notes</th>
                    <th>Token Cost</th>
                    <th>Total Tokens</th>
                </tr>
            </thead>
            <tbody>
`;

    data.forEach(row => {
        const confidenceClass = row.confidence === 'high' ? 'confidence-high' : 
                               row.confidence === 'medium' ? 'confidence-medium' : 'confidence-low';
        const urlClass = row.websiteUrl && row.websiteUrl !== 'Not Found' ? 'url-found' : 'url-not-found';
        const rowClass = row.isSummary ? 'summary-row' : '';
        
        html += `
                <tr class="${rowClass}">
                    <td class="model-name">${row.model}</td>
                    <td>${row.brandName}</td>
                    <td class="${urlClass}">${row.websiteUrl}</td>
                    <td class="${confidenceClass}">${row.confidence}</td>
                    <td class="description">${row.description}</td>
                    <td>${row.location}</td>
                    <td>${row.specialties}</td>
                    <td class="notes">${row.notes}</td>
                    <td class="cost">$${row.tokenCost.toFixed(4)}</td>
                    <td class="cost">${row.totalTokens}</td>
                </tr>`;
    });

    html += `
            </tbody>
        </table>
    </div>
</body>
</html>`;

    return html;
}

// Function to generate summary statistics
function generateSummaryStats(data) {
    const models = {};
    
    data.forEach(row => {
        if (row.isSummary) return; // Skip summary rows
        
        if (!models[row.model]) {
            models[row.model] = {
                totalBrands: 0,
                foundUrls: 0,
                highConfidence: 0,
                mediumConfidence: 0,
                lowConfidence: 0,
                totalCost: 0,
                totalTokens: 0
            };
        }
        
        const model = models[row.model];
        model.totalBrands++;
        if (row.websiteUrl && row.websiteUrl !== 'Not Found') model.foundUrls++;
        if (row.confidence === 'high') model.highConfidence++;
        if (row.confidence === 'medium') model.mediumConfidence++;
        if (row.confidence === 'low') model.lowConfidence++;
        model.totalCost += row.tokenCost;
        model.totalTokens += row.totalTokens;
    });
    
    console.log('\n=== MODEL COMPARISON SUMMARY ===\n');
    Object.entries(models).forEach(([modelName, stats]) => {
        console.log(`${modelName}:`);
        console.log(`  URLs Found: ${stats.foundUrls}/${stats.totalBrands} (${(stats.foundUrls/stats.totalBrands*100).toFixed(1)}%)`);
        console.log(`  High Confidence: ${stats.highConfidence}`);
        console.log(`  Medium Confidence: ${stats.mediumConfidence}`);
        console.log(`  Low Confidence: ${stats.lowConfidence}`);
        console.log(`  Total Cost: $${stats.totalCost.toFixed(4)}`);
        console.log(`  Total Tokens: ${stats.totalTokens}`);
        console.log(`  Avg Cost per Brand: $${(stats.totalCost/stats.totalBrands).toFixed(4)}`);
        console.log('');
    });
}

// Main execution
function main() {
    console.log('Reading report files...');
    const tableData = assembleTableData();
    
    console.log(`Assembled data for ${tableData.length} rows`);
    
    // Generate summary statistics
    generateSummaryStats(tableData);
    
    // Generate HTML table
    const htmlTable = generateHTMLTable(tableData);
    
    // Write HTML file
    fs.writeFileSync('brand_analysis_report.html', htmlTable);
    console.log('HTML report generated: brand_analysis_report.html');
    
    // Also save the raw data as JSON for further analysis
    fs.writeFileSync('assembled_data.json', JSON.stringify(tableData, null, 2));
    console.log('Raw data saved: assembled_data.json');
    
    return tableData;
}

// Export functions for use in other scripts
module.exports = {
    readAllReports,
    assembleTableData,
    generateHTMLTable,
    generateSummaryStats,
    main
};

// Run if called directly
if (require.main === module) {
    main();
} 