# Knife Brand Website Finder

A Node.js script that uses the OpenRouter API with web search capabilities to find official websites for knife and blade brands. The script leverages AI models with internet access to search for and extract brand information including official websites, descriptions, and additional details.

## Features

- 🔍 **Web Search Integration**: Uses OpenRouter's `:online` models for real-time internet access
- 🤖 **Multiple AI Models**: Support for 8 different AI models with internet capabilities
- 📊 **Structured Output**: Saves results as JSON files with comprehensive metadata
- ⚙️ **Configurable**: Easy model switching and batch size configuration
- 📈 **Progress Tracking**: Real-time progress updates and detailed summaries
- 🛡️ **Error Handling**: Robust error handling with fallback responses
- ⏹️ **Graceful Interruption**: Press Ctrl+C to stop and save partial results
- 🔄 **Duplicate Prevention**: Automatically skips processing if sufficient results already exist
- 🔢 **Token Tracking**: Comprehensive token usage and cost tracking for each brand and model

## Graceful Shutdown

The script supports graceful interruption to save partial results:

- **Press Ctrl+C** to stop the script at any time
- Partial results are automatically saved with `_PARTIAL_` in the filename
- Shows summary of completed searches before exiting
- **Press Ctrl+C twice** for immediate force termination

### Partial Results Example

When interrupted, you'll see:

```
⚠️  Received SIGINT (Ctrl+C). Gracefully shutting down...
📝 Saving partial results...
💾 Partial results saved to: ./results/brand_websites_gpt-4o-mini_PARTIAL_2024-01-15T10-35-22-456Z.json

📊 PARTIAL SUMMARY (5 brands processed)
✅ Successful: 4
❌ Failed: 1

👋 Goodbye!
```

The partial results file includes a special status field:

```json
{
  "metadata": {
    "status": "PARTIAL_RESULTS_DUE_TO_INTERRUPTION",
    ...
  }
}
```

## Duplicate Prevention

The script automatically checks for existing results to prevent unnecessary API calls and costs:

- **Automatic Detection**: Checks if a model already has sufficient successful results
- **Smart Skipping**: Won't reprocess if 10+ successful entries already exist
- **Force Override**: Use `--force` flag to process anyway
- **View Existing**: Use `--show` flag to display existing results

### Examples

```bash
# Will skip if results already exist
node getBrandWebsite.js gpt-4o-mini

# Force reprocessing even if results exist
node getBrandWebsite.js gpt-4o-mini 10 0 --force

# Show existing results without processing
node getBrandWebsite.js gpt-4o-mini 10 0 --show
```

## Supported Models

All models include internet access via OpenRouter's web search feature:

- `gpt-4o` - OpenAI GPT-4o (most capable, higher cost)
- `gpt-4o-mini` - OpenAI GPT-4o Mini (default, balanced performance/cost)
- `claude-3.5-sonnet` - Anthropic Claude 3.5 Sonnet
- `claude-3-haiku` - Anthropic Claude 3 Haiku (fastest)
- `gemini-2.5-pro` - Google Gemini 2.5 Pro (latest)
- `gemini-1.5-pro` - Google Gemini 1.5 Pro
- `qwen-2.5-72b` - Qwen 2.5 72B Instruct
- `llama-3.1-70b` - Meta Llama 3.1 70B Instruct

## Prerequisites

- Node.js 18.0.0 or higher
- OpenRouter API key

## Setup

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Get an OpenRouter API Key**

   - Visit [OpenRouter.ai](https://openrouter.ai)
   - Create an account and generate an API key
   - Add credits to your account (web search costs $4 per 1,000 results)

3. **Set Environment Variable**

   **Option A: Environment Variable**

   ```bash
   export OPENROUTER_API_KEY="your-api-key-here"
   ```

   **Option B: .env File (Recommended)**

   ```bash
   # Create .env file in the project root
   echo "OPENROUTER_API_KEY=your-api-key-here" > .env
   ```

4. **Verify Setup**
   ```bash
   npm run setup
   ```

## Usage

### Basic Usage (Default: 10 brands with gpt-4o-mini)

```bash
node getBrandWebsite.js
```

### Specify Model

```bash
node getBrandWebsite.js claude-3.5-sonnet
```

### Specify Model and Count

```bash
node getBrandWebsite.js gpt-4o 5
```

### Specify Model, Count, and Starting Index

```bash
node getBrandWebsite.js gemini-2.5-pro 10 20
```

### Using npm scripts

```bash
# Default run
npm start

# Test with 3 brands
npm test

# Force rerun (ignores existing results)
npm run force

# Show existing results
npm run show

# Show help
npm run help
```

## Command Line Arguments

```bash
node getBrandWebsite.js [model] [count] [startIndex] [flags]
```

- `model` (optional): Model key from supported models list (default: `gpt-4o-mini`)
- `count` (optional): Number of brands to process (default: `10`)
- `startIndex` (optional): Starting index in the brand list (default: `0`)

### Flags

- `--force`, `-f`: Force processing even if sufficient results already exist
- `--show`, `-s`: Display existing results without processing new ones

### Examples

```bash
# Basic usage
node getBrandWebsite.js

# Specific model and count
node getBrandWebsite.js claude-3.5-sonnet 5

# Force reprocessing
node getBrandWebsite.js gpt-4o 10 0 --force

# Show existing results
node getBrandWebsite.js gpt-4o-mini --show
```

## Output

Results are saved in the `./results/` directory with filenames like:

```
brand_websites_gpt-4o-mini_2024-01-15T10-30-45-123Z.json
```

### Output Structure

```json
{
  "metadata": {
    "model_used": "gpt-4o-mini",
    "model_name": "openai/gpt-4o-mini:online",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "total_brands_processed": 10,
    "successful_searches": 8,
    "failed_searches": 2,
    "success_rate": "80.0%",
    "error_breakdown": {},
    "model_availability": "working",
    "token_usage": {
      "total_prompt_tokens": 12340,
      "total_completion_tokens": 3507,
      "total_tokens": 15847,
      "total_cost_credits": 1247,
      "estimated_cost_usd": 0.001247,
      "average_tokens_per_brand": 1585,
      "average_cost_per_brand": 124.7,
      "total_requests": 10,
      "per_brand_breakdown": [
        {
          "brand_name": "Benchmade",
          "prompt_tokens": 1234,
          "completion_tokens": 567,
          "total_tokens": 1801,
          "cost": 142.5
        }
      ]
    }
  },
  "results": [
    {
      "brand_name": "Benchmade",
      "website_url": "https://www.benchmade.com",
      "description": "Premium American knife manufacturer known for high-quality folding knives",
      "additional_info": {
        "founded": "1988",
        "location": "Oregon, USA",
        "specialties": "Folding knives, tactical knives, EDC"
      },
      "search_confidence": "high",
      "notes": null,
      "model_used": "gpt-4o-mini",
      "timestamp": "2024-01-15T10:30:45.123Z",
      "raw_response": "...",
      "error_type": null,
      "success": true,
      "token_usage": {
        "prompt_tokens": 1234,
        "completion_tokens": 567,
        "total_tokens": 1801,
        "cost": 142.5
      }
    }
  ]
}
```

## Example Output

```
🔧 CONFIGURATION
Model: gpt-4o-mini
Brands to process: 10
Starting from index: 0
Available models: gpt-4o, gpt-4o-mini, claude-3.5-sonnet, claude-3-haiku, gemini-2.5-pro, gemini-1.5-pro, qwen-2.5-72b, llama-3.1-70b

🚀 Processing 10 brands using model: gpt-4o-mini
📋 Brands: ABKT, 5ive Star Gear, 5.11 Tactical, Aclim8, Acta Non Verba Knives, Actilam, AGA Campolin, Aiorosu Knives, AKC, Al Mar Knives

[1/10] Processing: ABKT
🔍 Searching for ABKT using gpt-4o-mini...

[2/10] Processing: 5ive Star Gear
🔍 Searching for 5ive Star Gear using gpt-4o-mini...

...

💾 Results saved to: ./results/brand_websites_gpt-4o-mini_2024-01-15T10-30-45-123Z.json

📊 SUMMARY
==================================================
Model used: gpt-4o-mini
Total brands processed: 10
Successful searches: 8
Failed searches: 2

🔢 TOKEN USAGE
------------------------------
Total tokens: 15,847
  • Prompt tokens: 12,340
  • Completion tokens: 3,507
Total cost: 1,247 credits (~$0.001247)
Average per brand: 1,585 tokens
Average cost per brand: 124.70 credits
Total API requests: 10

✅ MODEL STATUS: Working properly

🎯 SUCCESSFUL FINDS:
  • 5ive Star Gear: https://www.5ivestar.com (1,654 tokens)
  • 5.11 Tactical: https://www.511tactical.com (1,432 tokens)
  • Al Mar Knives: https://www.almarknives.com (1,789 tokens)
  ...

❌ FAILED SEARCHES:
  • ABKT: No official website found (1,234 tokens)
  • Aclim8: Brand appears to be discontinued (1,567 tokens)

✅ Search completed successfully
```

## Configuration

Edit the `CONFIG` object in `getBrandWebsite.js` to customize:

- `DEFAULT_MODEL`: Change the default model
- `INITIAL_BRAND_COUNT`: Change default number of brands to process
- `OUTPUT_DIR`: Change output directory
- `TIMEOUT`: Adjust API timeout (milliseconds)

## Cost Estimation

OpenRouter pricing varies by model. Web search adds $4 per 1,000 results. For 10 brands:

- **gpt-4o-mini**: ~$0.10-0.20 + $0.04 (web search)
- **claude-3-haiku**: ~$0.05-0.10 + $0.04 (web search)
- **gpt-4o**: ~$0.50-1.00 + $0.04 (web search)

## Error Handling

The script includes comprehensive error handling:

- API timeouts and failures
- JSON parsing errors
- Missing environment variables
- Invalid model names
- Network connectivity issues

## Troubleshooting

### Common Issues

1. **"OPENROUTER_API_KEY environment variable is required"**

   - Set your API key: `export OPENROUTER_API_KEY="your-key"`

2. **"Model 'xyz' not found"**

   - Use one of the supported model keys listed above

3. **API timeout errors**

   - Increase `TIMEOUT` in config or try a faster model like `claude-3-haiku`

4. **Rate limiting**
   - The script includes 1-second delays between requests
   - Consider using a smaller batch size

### Debug Mode

Add console logging by modifying the script or check the `raw_response` field in output files.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with different models
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Disclaimer

This tool is for research and informational purposes. Always verify website URLs and brand information independently. The accuracy of results depends on the AI model's web search capabilities and the availability of current information online.

## Token Tracking

The script automatically tracks detailed token usage and costs for complete transparency:

### What's Tracked

- **Per-Brand Tokens**: Individual token counts for each brand search
- **Model Totals**: Cumulative tokens and costs for the entire run
- **Cost Breakdown**: Prompt tokens, completion tokens, and total costs
- **Averages**: Average tokens and cost per brand

### Token Information Displayed

```
🔢 TOKEN USAGE
------------------------------
Total tokens: 15,847
  • Prompt tokens: 12,340
  • Completion tokens: 3,507
Total cost: 1,247 credits (~$0.001247)
Average per brand: 1,585 tokens
Average cost per brand: 124.70 credits
Total API requests: 10
```

### Per-Brand Token Details

Each result includes individual token usage:

```json
{
  "brand_name": "Benchmade",
  "website_url": "https://www.benchmade.com",
  "token_usage": {
    "prompt_tokens": 1234,
    "completion_tokens": 567,
    "total_tokens": 1801,
    "cost": 142.5
  }
}
```

### Comprehensive Metadata

Results files include detailed token statistics:

```json
{
  "metadata": {
    "token_usage": {
      "total_prompt_tokens": 12340,
      "total_completion_tokens": 3507,
      "total_tokens": 15847,
      "total_cost_credits": 1247,
      "estimated_cost_usd": 0.001247,
      "average_tokens_per_brand": 1585,
      "average_cost_per_brand": 124.7,
      "total_requests": 10,
      "per_brand_breakdown": [
        {
          "brand_name": "Benchmade",
          "prompt_tokens": 1234,
          "completion_tokens": 567,
          "total_tokens": 1801,
          "cost": 142.5
        }
      ]
    }
  }
}
```

### Viewing Token Usage

- **Live Display**: Token counts shown during processing and in final summary
- **Individual Results**: Each brand result shows its token usage
- **Historical Data**: Use `--show` flag to view token usage from previous runs
- **Partial Results**: Token tracking continues even when interrupted with Ctrl+C
