import path = require("path");
import fs = require("fs");
import core = require("@actions/core");

export class KubeflowActionMock {
    public pipelineTask: string;
    public pipelineFilePath: string;
    public maxFileSizeBytes: number;
    public pipelineParams: string;

    constructor(pipelineTask: string, pipelineFilePath: string, pipelineParams: string) {
        this.pipelineTask = pipelineTask;
        this.pipelineFilePath = pipelineFilePath;
        this.maxFileSizeBytes = 32000000;
        this.pipelineParams = pipelineParams;
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

    public async validatePipelineFileSizePass() {
        try {
            const stats = fs.statSync(this.pipelineFilePath);
            const fileSizeInBytes = stats.size;
            if(fileSizeInBytes > this.maxFileSizeBytes) {
                return false;
            }
            return true;
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async validatePipelineFileSizeFail() {
        try {
            const stats = fs.statSync(this.pipelineFilePath);
            const fileSizeInBytes = stats.size;
            if(fileSizeInBytes > 32) {
                return false;
            }
            return true;
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async runValidations() {
        try {
            if(!await this.validatePipelineFilePath()) {return false;}
            if(!await this.validatePipelineFileSizePass()) {return false;}
            if(!await this.validatePipelineParams()) {return false;}
            return true;
        }
        catch(error) {
            core.setFailed(error.message);
        }
    }

    public async validatePipelineParams() {
        try {
            if(this.pipelineParams == '') {
                return true;
            }
            JSON.parse(this.pipelineParams);
            return true;
        }
        catch(error) {
            return false;
        }
    }
}