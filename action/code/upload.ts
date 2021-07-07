import path = require("path");
import fs = require("fs");
import core = require("@actions/core");
import * as rest from "typed-rest-client";
import{request, OutgoingHttpHeaders} from "http";
import FormData from "form-data";
import { IAllPipeline } from "./interfaces";
import { IAllPipelineVersion } from "./interfaces";

export class UploadPipeline{
    public endpointUrl: string;
    public getAllPipelinesEndpoint: string;
    public getAllVersionsEndpoint: string;
    private bearerToken: string;
    public pipelineTask: string;
    public pipelineFilePath: string;
    public newPipelineName: string | undefined;
    public existingPipelineName: string | undefined;
    public versionName: string | undefined;
    public pipelineID: string;
    public restAPIClient: rest.RestClient;
    public maxFileSizeBytes: number;

    constructor() {
        this.endpointUrl = core.getInput('kubeflowEndpoint')!;
        this.getAllPipelinesEndpoint = 'pipeline/apis/v1beta1/pipelines';
        this.getAllVersionsEndpoint = 'pipeline/apis/v1beta1/pipeline_versions';
        this.bearerToken = core.getInput('bearerToken')!;
        this.pipelineTask = core.getInput('kubeflowPipelineTask')!;
        this.pipelineFilePath = core.getInput('pipelineFilePath')!;
        this.newPipelineName = core.getInput('newPipelineName')!;
        this.existingPipelineName = core.getInput('existingPipelineName')!;
        this.versionName = core.getInput('versionName')!;
        this.pipelineID = '';
        this.restAPIClient = new rest.RestClient('agent');
        this.maxFileSizeBytes = 32000000;
    }

    public async validateEndpointUrl() {
        try {
            var options: rest.IRequestOptions = {additionalHeaders: {'Cookie': `authservice_session=${this.bearerToken};`}};
            var req = await this.restAPIClient.get(this.endpointUrl, options);
            if(req.statusCode == 200) {
                return true;
            }
            if(req.statusCode == 404) {
                return true;
            }
            return false;
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async validatePipelineFilePath() {
        try {
            if(fs.statSync(this.pipelineFilePath).isFile()) {
                if(this.pipelineFilePath.substring(this.pipelineFilePath.length - 7, this.pipelineFilePath.length) == '.tar.gz') {
                    return true;
                }
                else {
                    return false;
                }
            }
            else {
                return false;
            }
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async validatePipelineFileSize() {
        try {
            const stats = fs.statSync(this.pipelineFilePath);
            const fileSizeInBytes = stats.size;
            // console.log(`Chosen file's size is ${fileSizeInBytes} Bytes.`);
            if(fileSizeInBytes > this.maxFileSizeBytes) {
                return false
            }
            return true;
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async validateNewPipelineName() {
        try {
            if(this.newPipelineName == undefined || this.newPipelineName == '') {
                return false;
            }
            var url = `${this.endpointUrl}${this.getAllPipelinesEndpoint}?filter={"predicates":[{"key":"name","op":"EQUALS","string_value":"${this.newPipelineName}"}]}`;
            url = encodeURI(url);
            var options: rest.IRequestOptions = {additionalHeaders: {'Cookie': `authservice_session=${this.bearerToken};`}};
            var webRequest = await this.restAPIClient.get<IAllPipeline>(url, options)!;
            if(webRequest.result != null) {
                if(webRequest.result.pipelines != undefined){
                    for(var PL of webRequest.result.pipelines) {
                        if(PL.name == this.newPipelineName) {
                            return false;
                        }
                    }
                    core.setOutput('kf_pipeline_name', this.newPipelineName);
                    return true;
                }
                else {
                    return true;
                }
            }
            else {
                throw new Error('Request did not go through. Make sure your Url is valid, and that you have the correct bearer token, if needed.');
            }
        } 
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async validateExistingPipelineName() {
        try {
            if(this.existingPipelineName == undefined || this.existingPipelineName == '') {
                return false;
            }
            var url = `${this.endpointUrl}${this.getAllPipelinesEndpoint}?filter={"predicates":[{"key":"name","op":"EQUALS","string_value":"${this.existingPipelineName}"}]}`;
            url = encodeURI(url);
            var options: rest.IRequestOptions = {additionalHeaders: {'Cookie': `authservice_session=${this.bearerToken};`}};
            var webRequest = await this.restAPIClient.get<IAllPipeline>(url, options)!;
            if(webRequest.result != null) {
                if(webRequest.result.pipelines != undefined){
                    for(var PL of webRequest.result.pipelines!) {
                        if(PL.name == this.existingPipelineName) {
                            this.pipelineID = PL.id;
                            core.setOutput('kf_pipeline_name', PL.name);
                            core.setOutput('kf_pipeline_id', PL.id);
                            return true;
                        }
                    }
                    return false;
                }
                else {
                    return false;
                }
            }
            else {
                throw new Error('Request did not go through. Make sure your Url is valid, and that you have the correct bearer token, if needed.');
            }
        } 
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async validateNewVersionName() {
        try{
            if(this.versionName == undefined || this.versionName == '') {
                return false;
            }
            var url = `${this.endpointUrl}${this.getAllVersionsEndpoint}?resource_key.type=PIPELINE&resource_key.id=${this.pipelineID}&filter={"predicates":[{"key":"name","op":"EQUALS","string_value":"${this.versionName}"}]}`;
            url = encodeURI(url);
            var options: rest.IRequestOptions = {additionalHeaders: {'Cookie': `authservice_session=${this.bearerToken};`}};
            var webRequest = await this.restAPIClient.get<IAllPipelineVersion>(url, options)!;
            if(webRequest.result != null) {
                var versions = webRequest.result.versions;
                if(versions != undefined) {
                    for(var i = 0; i < versions.length; i++) {
                        if(versions[i].name == this.versionName) {
                            return false;
                        }
                    }
                    core.setOutput('kf_pipeline_version_name', this.versionName);
                    return true;
                }
                return false;
            }
            return false;
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async runValidations() {
        try {
            if(!await this.validateEndpointUrl()) {
                throw new Error('Endpoint Url must be a valid url.');
            }
            if(!await this.validatePipelineFilePath()) {
                throw new Error('File path must be valid and end with the .gz extension.');
            }
            if(!await this.validatePipelineFileSize()) {
                throw new Error('File size cannot exceed 32MB.');
            }
            if(this.pipelineTask == 'uploadNew') {
                if(!await this.validateNewPipelineName()) {
                    throw new Error('Pipeline name already exists. You must choose an original pipeline name.');
                }
            }
            else if(this.pipelineTask == 'uploadNewVersion') {
                if(!await this.validateExistingPipelineName()) {
                    throw new Error('Pipeline name does not yet exist. You must enter an existing pipeline name or choose to upload a new pipeline.');
                }
                if(!await this.validateNewVersionName()) {
                    throw new Error('Version name already exists. You must enter a unique version name.');
                }
            }
            return true;
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    // To post a new pipeline you have to pipe a file payload as form data and add the name onto the url as a string
    public async uploadNewPipeline() {
        try {
            var uploadFile = fs.createReadStream(this.pipelineFilePath);
            var form: FormData = new FormData();
            form.append('uploadfile', uploadFile);
            var reqHost = this.endpointUrl.substring(7, this.endpointUrl.length - 1);

            var reqHeaders = form.getHeaders({'Cookie': `authservice_session=${this.bearerToken};`});
            await this.newPLPostRequest(reqHeaders, reqHost, form);
            await this.wait(5000);
            var pipelineID = await this.getPipelineID(this.newPipelineName);
            if(pipelineID == 'Not a valid pipeline id.') {
                throw new Error('Existing pipeline not found. Check endpoint url. Either choose an new pipeline name or create a new version.');
            }
            console.log(`\nThe new pipeline's ID is: ${pipelineID}`);
            console.log(`New pipeline can be viewed at: ${this.endpointUrl}_/pipeline/#/pipelines/details/${pipelineID}`);
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async newPLPostRequest(reqHeaders: OutgoingHttpHeaders, reqHost: string, form: FormData) {
        var req = request(
            {
                host: reqHost,
                path: encodeURI(`/${this.getAllPipelinesEndpoint}/upload?name=${this.newPipelineName}`),
                method: 'POST',
                headers: reqHeaders,
            },
            response => {
                try {
                    response.on('data', d => {
                        process.stdout.write(d);
                    })
                    console.log(`Response returned with status code ${response.statusCode}: ${response.statusMessage}`);
                }
                catch(error) {
                    core.setFailed(`${error.message} Make sure that your endpoint is correct, and that you are using the correct bearer token, if neccessary.`);
                }
            }
        );
        form.pipe(req);
    }

    // To post a new version you have to pipe a file payload as form data and add the name and pipeline id onto the url as a string
    public async uploadNewPipelineVersion() {
        try {
            var uploadFile = fs.createReadStream(this.pipelineFilePath);
            var form: FormData = new FormData();
            form.append('uploadfile', uploadFile);
            var reqHost = this.endpointUrl.substring(7, this.endpointUrl.length - 1);
            var existingPLID = await this.getPipelineID(this.existingPipelineName);
            if(existingPLID == 'Not a valid pipeline id.') {
                throw new Error('Existing pipeline not found. Check endpoint url. Either choose an existing pipeline or create a new pipeline.');
            }

            var reqHeaders = form.getHeaders({'Cookie': `authservice_session=${this.bearerToken}`;});
            await this.newVersionPostRequest(reqHeaders, reqHost, form, existingPLID);
            await this.wait(5000);
            var versionID = await this.getPipelineVersionID(existingPLID);
            if(versionID == 'Not a valid version id.') {
                throw new Error('Existing version not found. Check endpoint url and bearer token.');
            }
            console.log(`\nThe new pipeline version's ID is: ${versionID}`);
            console.log(`New pipeline version can be viewed at: ${this.endpointUrl}_/pipeline/#/pipelines/details/${this.pipelineID}/version/${versionID}`);
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async getPipelineID(pipelineName: string | undefined): Promise<string> {
        try {
            var url = `${this.endpointUrl}${this.getAllPipelinesEndpoint}?filter={"predicates":[{"key":"name","op":"EQUALS","string_value":"${pipelineName}"}]}`;
            url = encodeURI(url);
            var options: rest.IRequestOptions = {additionalHeaders: {'Cookie': `authservice_session=${this.bearerToken};`}};
            var webRequest = await this.restAPIClient.get<IAllPipeline>(url, options)!;
            if(webRequest.result != null) {
                var pipelines = webRequest.result.pipelines;
                if(pipelines[0].id != undefined) {
                    core.setOutput('kf_pipeline_id', pipelines[0].id);
                    return pipelines[0].id;
                }
                console.log('Pipeline not found. Make sure your endpoint and/or bearer token are correct.');
                return 'Not a valid pipeline id.';
            }
            console.log('Request did not go through. Make sure your endpoint and/or bearer token are correct.');
            return 'Not a valid pipeline id.';
        }
        catch(error) {
            core.setFailed(error.message);
            return 'Not a valid pipeline id.';
        }
    }

    public async newVersionPostRequest(reqHeaders: OutgoingHttpHeaders, reqHost: string, form: FormData, existingPLID: string) {
        var req = request(
            {
                host: reqHost,
                path: encodeURI(`/${this.getAllPipelinesEndpoint}/upload_version?name=${this.versionName}&pipelineid=${existingPLID}`),
                method: 'POST',
                headers: reqHeaders,
            },
            response => {
                try {
                    response.on('data', d => {
                        process.stdout.write(d);
                    })
                    console.log(`Response returned with status code ${response.statusCode}: ${response.statusMessage}`);
                }
                catch(error) {
                    core.setFailed(`${error.message} Make sure that your endpoint is correct, and that you are using the correct bearer token, if neccessary.`);
                }
            }
        );
        form.pipe(req);
    }

    public async getPipelineVersionID(pipelineID: string): Promise<string> {
        try {
            var url = `${this.endpointUrl}${this.getAllVersionsEndpoint}?resource_key.type=PIPELINE&resource_key.id=${pipelineID}&filter={"predicates":[{"key":"name","op":"EQUALS","string_value":"${this.versionName}"}]}`;
            url = encodeURI(url);
            var options: rest.IRequestOptions = {additionalHeaders: {'Cookie': `authservice_session=${this.bearerToken};`}};
            var webRequest = await this.restAPIClient.get<IAllPipelineVersion>(url, options)!;
            if(webRequest.result != null) {
                var versions = webRequest.result.versions;
                if(versions != undefined) {
                    for(var i = 0; i < versions.length; i++) {
                        if(versions[i].name == this.versionName) {
                            core.setOutput('kf_pipeline_version_id', versions[i].id);
                            return versions[i].id;
                        }
                    }
                    return webRequest.result.versions[0].id;
                }
                console.log('Version not found. Make sure your endpoint and/or bearer token are correct.');
                return 'Not a valid version id.';
            }
            console.log('Request did not go through. Make sure your endpoint and/or bearer token are correct.');
            return 'Not a valid version id.';
        }
        catch(error) {
            core.setFailed(error.message);
            return 'Not a valid version id.';
        }
    }

    public async wait(ms: number) {
        await new Promise((resolve) => {
            setTimeout(resolve, ms);
         });
    }
}
